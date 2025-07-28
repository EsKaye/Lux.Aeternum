import { BaseAutomation } from './base-automation';
import { IAutomationConfig, IAutomationCapabilities } from '../interfaces/automation.interface';
import { IDevice, ILightCommand } from '../interfaces/device.interface';
import axios, { AxiosInstance } from 'axios';
import { Logger } from '../utils/logger';

interface AlexaDevice {
  entityId: string;
  displayName: string;
  description: string;
  capabilities: {
    name: string;
    interface: string;
    version: string;
    properties?: {
      supported: Array<{
        name: string;
      }>;
    };
  }[];
  cookie?: Record<string, unknown>;
}

export class AlexaAutomation extends BaseAutomation {
  private client: AxiosInstance;
  private refreshToken?: string;
  private accessToken?: string;
  private tokenExpiresAt: number = 0;
  private devices: IDevice[] = [];
  private readonly AUTH_URL = 'https://api.amazon.com/auth/o2/token';
  private readonly API_BASE_URL = 'https://api.amazonalexa.com/v3';

  constructor(config: Omit<IAutomationConfig, 'type'>) {
    const capabilities: IAutomationCapabilities = {
      voiceControl: true,
      deviceDiscovery: true,
      sceneManagement: true,
      scheduling: true,
      automationRules: true,
      remoteAccess: true,
    };

    super(
      'alexa',
      'Amazon Alexa',
      capabilities,
      {
        ...config,
        type: 'alexa',
      }
    );

    this.client = axios.create({
      baseURL: this.API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for token refresh
    this.client.interceptors.request.use(async (config) => {
      if (!this.accessToken || Date.now() >= this.tokenExpiresAt - 60000) {
        await this.refreshAccessToken();
      }
      config.headers.Authorization = `Bearer ${this.accessToken}`;
      return config;
    });
  }

  async connect(): Promise<boolean> {
    try {
      if (!this.config.auth?.refreshToken) {
        throw new Error('Refresh token is required for Alexa integration');
      }

      this.refreshToken = this.config.auth.refreshToken as string;
      await this.refreshAccessToken();
      
      this._isConnected = true;
      this.logger.info('Successfully connected to Alexa API');
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to Alexa:', error);
      this._isConnected = false;
      throw error;
    }
  }

  private async refreshAccessToken(): Promise<void> {
    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', this.refreshToken!);
      params.append('client_id', this.config.auth.clientId as string);
      params.append('client_secret', this.config.auth.clientSecret as string);

      const response = await axios.post(this.AUTH_URL, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000);
      
      // Update the refresh token if a new one was provided
      if (response.data.refresh_token) {
        this.refreshToken = response.data.refresh_token;
      }
    } catch (error) {
      this.logger.error('Failed to refresh Alexa access token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  async getDevices(): Promise<IDevice[]> {
    try {
      const response = await this.client.get('/devices');
      const alexaDevices: AlexaDevice[] = response.data.devices || [];
      
      this.devices = alexaDevices
        .filter(device => 
          device.capabilities.some(cap => 
            cap.interface === 'Alexa.PowerController' || 
            cap.interface === 'Alexa.ColorController' ||
            cap.interface === 'Alexa.BrightnessController'
          )
        )
        .map(device => this.mapAlexaDevice(device));
      
      return this.devices;
    } catch (error) {
      this.logger.error('Failed to fetch Alexa devices:', error);
      throw error;
    }
  }

  async executeCommand(command: ILightCommand): Promise<boolean> {
    try {
      const device = this.devices.find(d => d.id === command.deviceId);
      if (!device) {
        throw new Error(`Device not found: ${command.deviceId}`);
      }

      const endpoint = `/devices/${command.deviceId}/commands`;
      let payload: any = {};

      switch (command.type) {
        case 'turnOn':
          payload = {
            command: 'TurnOn',
            namespace: 'Alexa.PowerController',
            payload: {}
          };
          break;
          
        case 'turnOff':
          payload = {
            command: 'TurnOff',
            namespace: 'Alexa.PowerController',
            payload: {}
          };
          break;
          
        case 'setBrightness':
          if (typeof command.params.brightness === 'number') {
            const brightness = Math.round((command.params.brightness / 100) * 255);
            payload = {
              command: 'SetBrightness',
              namespace: 'Alexa.BrightnessController',
              payload: {
                brightness
              }
            };
          }
          break;
          
        case 'setColor':
          if (command.params.color) {
            // Convert hex to RGB
            const hex = command.params.color.startsWith('#') 
              ? command.params.color.substring(1) 
              : command.params.color;
              
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            
            // Convert RGB to HSV (Alexa uses HSV for color)
            const { h, s, v } = this.rgbToHsv(r, g, b);
            
            payload = {
              command: 'SetColor',
              namespace: 'Alexa.ColorController',
              payload: {
                color: {
                  hue: h,
                  saturation: s,
                  brightness: v
                }
              }
            };
          }
          break;
          
        default:
          throw new Error(`Unsupported command type: ${command.type}`);
      }

      if (Object.keys(payload).length > 0) {
        await this.client.post(endpoint, { commands: [payload] });
        
        // Update local device state
        const deviceIndex = this.devices.findIndex(d => d.id === command.deviceId);
        if (deviceIndex !== -1) {
          const updatedDevice = { ...this.devices[deviceIndex] };
          
          // Update device state based on command
          if (command.type === 'turnOn') {
            updatedDevice.isOn = true;
          } else if (command.type === 'turnOff') {
            updatedDevice.isOn = false;
          } else if (command.type === 'setBrightness' && typeof command.params.brightness === 'number') {
            updatedDevice.brightness = command.params.brightness;
          } else if (command.type === 'setColor' && command.params.color) {
            updatedDevice.color = command.params.color;
          }
          
          this.devices[deviceIndex] = updatedDevice;
          this.notifyDeviceUpdate(updatedDevice);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Failed to execute command ${command.type}:`, error);
      throw error;
    }
  }

  private mapAlexaDevice(device: AlexaDevice): IDevice {
    const capabilities = device.capabilities || [];
    const hasColor = capabilities.some(cap => cap.interface === 'Alexa.ColorController');
    const hasBrightness = capabilities.some(cap => cap.interface === 'Alexa.BrightnessController');
    
    return {
      id: device.entityId,
      name: device.displayName,
      type: 'light',
      brand: 'alexa',
      model: 'alexa-smart-device',
      address: device.entityId,
      isOn: false, // Initial state, will be updated after first sync
      isReachable: true,
      capabilities: {
        color: hasColor,
        brightness: hasBrightness,
        power: true,
      },
      metadata: {
        description: device.description,
        capabilities: device.capabilities,
        cookie: device.cookie,
      },
    };
  }

  private rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r = r / 255;
    g = g / 255;
    b = b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const v = max;
    const d = max - min;
    
    s = max === 0 ? 0 : d / max;

    if (max === min) {
      h = 0; // achromatic
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    // Convert to Alexa's expected format (degrees, 0-1, 0-1)
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100) / 100,
      v: Math.round(v * 100) / 100
    };
  }
}
