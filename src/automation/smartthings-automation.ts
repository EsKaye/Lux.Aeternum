import { BaseAutomation } from './base-automation';
import { IAutomationConfig, IAutomationCapabilities } from '../interfaces/automation.interface';
import { IDevice, ILightCommand } from '../interfaces/device.interface';
import { Logger } from '../utils/logger';
import axios, { AxiosInstance } from 'axios';

interface SmartThingsDevice {
  deviceId: string;
  name: string;
  label: string;
  deviceTypeId: string;
  deviceTypeName: string;
  deviceNetworkType: string;
  deviceManufacturerCode?: string;
  locationId: string;
  roomId?: string;
  components: Array<{
    id: string;
    label: string;
    capabilities: Array<{
      id: string;
      version: number;
    }>;
  }>;
  createTime: string;
  updateTime: string;
}

interface SmartThingsDeviceStatus {
  components: {
    main: {
      switch?: {
        switch: {
          value: 'on' | 'off';
        };
      };
      switchLevel?: {
        level: {
          value: number;
          unit: '%';
        };
      };
      colorControl?: {
        hue: {
          value: number;
        };
        saturation: {
          value: number;
        };
      };
    };
  };
}

/**
 * SmartThings automation platform implementation
 */
export class SmartThingsAutomation extends BaseAutomation {
  private client: AxiosInstance;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiresAt: number = 0;
  private readonly AUTH_URL = 'https://auth-global.api.smartthings.com/oauth/token';
  private readonly API_BASE_URL = 'https://api.smartthings.com/v1';
  private locationId?: string;

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
      'smartthings',
      'SmartThings',
      capabilities,
      {
        ...config,
        type: 'smartthings',
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
      this.locationId = config.auth.locationId as string;
    }
  }

  async connect(): Promise<boolean> {
    try {
      if (!this.refreshToken) {
        throw new Error('Refresh token is required for SmartThings integration');
      }

      await this.refreshAccessToken();
      
      // If no location ID was provided, try to get the first available location
      if (!this.locationId) {
        const locations = await this.getLocations();
        if (locations.length > 0) {
          this.locationId = locations[0].locationId;
          this.logger.info(`Using location: ${locations[0].name}`);
        } else {
          throw new Error('No locations found for the SmartThings account');
        }
      }
      
      this._isConnected = true;
      this.logger.info('Successfully connected to SmartThings API');
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to SmartThings:', error);
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
      this.logger.error('Failed to refresh SmartThings access token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  private async getLocations(): Promise<Array<{ locationId: string; name: string }>> {
    try {
      const response = await this.client.get('/locations');
      return response.data.items.map((location: any) => ({
        locationId: location.locationId,
        name: location.name,
      }));
    } catch (error) {
      this.logger.error('Failed to fetch SmartThings locations:', error);
      throw error;
    }
  }

  async getDevices(): Promise<IDevice[]> {
    try {
      const response = await this.client.get('/devices');
      const devices: SmartThingsDevice[] = response.data.items || [];
      
      // Get device statuses in parallel
      const deviceStatusPromises = devices.map(device => 
        this.getDeviceStatus(device.deviceId).catch(error => {
          this.logger.error(`Failed to get status for device ${device.deviceId}:`, error);
          return null;
        })
      );
      
      const deviceStatuses = await Promise.all(deviceStatusPromises);
      
      return devices.map((device, index) => {
        const status = deviceStatuses[index];
        const isOn = status?.components?.main?.switch?.switch.value === 'on';
        const brightness = status?.components?.main?.switchLevel?.level.value;
        
        let color: string | undefined;
        if (status?.components?.main?.colorControl) {
          const { hue, saturation } = status.components.main.colorControl;
          color = this.hsvToHex(hue.value / 100, saturation.value / 100, 1);
        }
        
        return this.mapSmartThingsDevice(device, isOn, brightness, color);
      });
    } catch (error) {
      this.logger.error('Failed to fetch SmartThings devices:', error);
      throw error;
    }
  }

  private async getDeviceStatus(deviceId: string): Promise<SmartThingsDeviceStatus> {
    try {
      const response = await this.client.get(`/devices/${deviceId}/status`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get status for device ${deviceId}:`, error);
      throw error;
    }
  }

  async executeCommand(command: ILightCommand): Promise<boolean> {
    if (!this._isConnected) {
      throw new Error('Not connected to SmartThings API');
    }

    const deviceId = command.deviceId;
    const device = await this.getDevice(deviceId);
    
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    try {
      switch (command.type) {
        case 'turnOn':
          await this.turnOnDevice(deviceId);
          device.isOn = true;
          break;
          
        case 'turnOff':
          await this.turnOffDevice(deviceId);
          device.isOn = false;
          break;
          
        case 'setBrightness':
          if (typeof command.params.brightness === 'number') {
            await this.setDeviceBrightness(deviceId, command.params.brightness);
            device.brightness = command.params.brightness;
          }
          break;
          
        case 'setColor':
          if (command.params.color) {
            await this.setDeviceColor(deviceId, command.params.color);
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

  private async turnOnDevice(deviceId: string): Promise<void> {
    await this.client.post(`/devices/${deviceId}/commands`, {
      commands: [
        {
          component: 'main',
          capability: 'switch',
          command: 'on',
        },
      ],
    });
  }

  private async turnOffDevice(deviceId: string): Promise<void> {
    await this.client.post(`/devices/${deviceId}/commands`, {
      commands: [
        {
          component: 'main',
          capability: 'switch',
          command: 'off',
        },
      ],
    });
  }

  private async setDeviceBrightness(deviceId: string, brightness: number): Promise<void> {
    // Convert percentage to 0-100 range expected by SmartThings
    const level = Math.round((brightness / 100) * 100);
    
    await this.client.post(`/devices/${deviceId}/commands`, {
      commands: [
        {
          component: 'main',
          capability: 'switchLevel',
          command: 'setLevel',
          arguments: [level],
        },
      ],
    });
  }

  private async setDeviceColor(deviceId: string, colorHex: string): Promise<void> {
    // Convert hex to HSV (SmartThings uses HSV for color control)
    const { h, s } = this.hexToHsv(colorHex);
    
    // SmartThings expects hue in 0-100 range and saturation in 0-100 range
    const hue = Math.round((h / 360) * 100);
    const saturation = Math.round(s * 100);
    
    await this.client.post(`/devices/${deviceId}/commands`, {
      commands: [
        {
          component: 'main',
          capability: 'colorControl',
          command: 'setColor',
          arguments: [
            {
              hue,
              saturation,
            },
          ],
        },
      ],
    });
  }

  private mapSmartThingsDevice(
    device: SmartThingsDevice,
    isOn: boolean = false,
    brightness?: number,
    color?: string
  ): IDevice {
    const hasSwitch = device.components.some(component => 
      component.capabilities.some(cap => cap.id === 'switch')
    );
    
    const hasColor = device.components.some(component => 
      component.capabilities.some(cap => cap.id === 'colorControl')
    );
    
    const hasBrightness = device.components.some(component => 
      component.capabilities.some(cap => cap.id === 'switchLevel')
    );

    return {
      id: device.deviceId,
      name: device.label || device.name,
      type: 'light', // Default type, could be determined by deviceTypeName
      brand: device.deviceManufacturerCode || 'smartthings',
      model: device.deviceTypeName || 'smartthings-device',
      address: device.deviceId,
      isOn,
      brightness,
      color,
      isReachable: true, // Assume device is reachable if we can get its status
      capabilities: {
        power: hasSwitch,
        brightness: hasBrightness,
        color: hasColor,
      },
      metadata: {
        deviceTypeId: device.deviceTypeId,
        deviceNetworkType: device.deviceNetworkType,
        locationId: device.locationId,
        roomId: device.roomId,
        components: device.components,
      },
    };
  }

  private hexToHsv(hex: string): { h: number; s: number; v: number } {
    // Remove the '#' if present
    hex = hex.replace(/^#/, '');
    
    // Parse the hex color to RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    
    // Find the minimum and maximum values of R, G, and B
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    let h = 0;
    let s = 0;
    const v = max;
    
    // Calculate hue
    if (delta !== 0) {
      if (max === r) {
        h = ((g - b) / delta) % 6;
      } else if (max === g) {
        h = (b - r) / delta + 2;
      } else {
        h = (r - g) / delta + 4;
      }
      
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }
    
    // Calculate saturation
    s = max === 0 ? 0 : delta / max;
    
    return { h, s, v };
  }

  private hsvToHex(h: number, s: number, v: number): string {
    let r = 0, g = 0, b = 0;
    
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    
    // Convert to hex
    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}
