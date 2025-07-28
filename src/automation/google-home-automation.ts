import { BaseAutomation } from './base-automation';
import { IAutomationConfig, IAutomationCapabilities } from '../interfaces/automation.interface';
import { IDevice, ILightCommand } from '../interfaces/device.interface';
import { Logger } from '../utils/logger';
import axios, { AxiosInstance } from 'axios';

interface GoogleDevice {
  id: string;
  type: string;
  traits: string[];
  name: {
    name: string;
    defaultNames: string[];
    nicknames: string[];
  };
  willReportState: boolean;
  roomHint?: string;
  deviceInfo?: {
    manufacturer: string;
    model: string;
    hwVersion: string;
    swVersion: string;
  };
  customData?: Record<string, unknown>;
  otherDeviceIds?: Array<{
    deviceId: string;
  }>;
}

/**
 * Google Home automation platform implementation
 */
export class GoogleHomeAutomation extends BaseAutomation {
  private client: AxiosInstance;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiresAt: number = 0;
  private readonly AUTH_URL = 'https://oauth2.googleapis.com/token';
  private readonly API_BASE_URL = 'https://homegraph.googleapis.com/v1';

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
      'google-home',
      'Google Home',
      capabilities,
      {
        ...config,
        type: 'google-home',
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

    // Extract tokens from config
    if (config.auth) {
      this.accessToken = config.auth.accessToken as string;
      this.refreshToken = config.auth.refreshToken as string;
      this.tokenExpiresAt = (config.auth.expiresAt as number) || 0;
    }
  }

  async connect(): Promise<boolean> {
    try {
      if (!this.refreshToken) {
        throw new Error('Refresh token is required for Google Home integration');
      }

      await this.refreshAccessToken();
      this._isConnected = true;
      this.logger.info('Successfully connected to Google Home API');
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to Google Home:', error);
      this._isConnected = false;
      throw error;
    }
  }

  private async refreshAccessToken(): Promise<void> {
    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', this.refreshToken!);
      params.append('client_id', this.config.auth?.clientId as string);
      params.append('client_secret', this.config.auth?.clientSecret as string);

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
      this.logger.error('Failed to refresh Google access token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  async getDevices(): Promise<IDevice[]> {
    try {
      // In a real implementation, we would query the Google Home Graph API
      // This is a simplified example that returns mock data
      const mockDevices: IDevice[] = [
        {
          id: 'google-light-1',
          name: 'Google Light',
          type: 'light',
          brand: 'google',
          model: 'google-light',
          address: 'google-light-1',
          isOn: false,
          isReachable: true,
          capabilities: {
            power: true,
            brightness: true,
            color: true,
            colorTemperature: true
          },
          metadata: {
            traits: ['action.devices.traits.OnOff', 'action.devices.traits.Brightness', 'action.devices.traits.ColorSetting']
          }
        }
      ];

      return mockDevices;
    } catch (error) {
      this.logger.error('Failed to fetch Google Home devices:', error);
      throw error;
    }
  }

  async executeCommand(command: ILightCommand): Promise<boolean> {
    if (!this._isConnected) {
      throw new Error('Not connected to Google Home API');
    }

    const deviceId = command.deviceId;
    const device = await this.getDevice(deviceId);
    
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    try {
      // In a real implementation, we would send the command to the Google Home Graph API
      // This is a simplified example that updates the local device state
      switch (command.type) {
        case 'turnOn':
          this.logger.info(`Turning on device: ${device.name}`);
          device.isOn = true;
          break;
          
        case 'turnOff':
          this.logger.info(`Turning off device: ${device.name}`);
          device.isOn = false;
          break;
          
        case 'setBrightness':
          if (typeof command.params.brightness === 'number') {
            this.logger.info(`Setting brightness of ${device.name} to ${command.params.brightness}%`);
            device.brightness = command.params.brightness;
          }
          break;
          
        case 'setColor':
          if (command.params.color) {
            this.logger.info(`Setting color of ${device.name} to ${command.params.color}`);
            device.color = command.params.color;
          }
          break;
          
        default:
          throw new Error(`Unsupported command type: ${command.type}`);
      }
      
      // Notify listeners of the device update
      this.notifyDeviceUpdate(device);
      return true;
      
    } catch (error) {
      this.logger.error(`Failed to execute command on device ${deviceId}:`, error);
      throw error;
    }
  }
}
