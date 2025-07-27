import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { IDevice, ILightCommand, ILightEvent, IAdapterConfig } from '../interfaces/device.interface';
import { BaseLightAdapter, AdapterError } from '../interfaces/adapter.interface';
import { createLogger, Logger } from '../utils/logger';

/**
 * Govee-specific device properties
 */
export interface IGoveeDevice extends IDevice {
  /** Govee device model */
  model: string;
  /** Govee device version */
  version: string;
  /** Device support list */
  supportCmds: string[];
  /** Device online status */
  isOnline: boolean;
  /** Device controllable status */
  isControllable: boolean;
  /** Device retrievable status */
  isRetrievable: boolean;
}

/**
 * Govee API response structure
 */
interface IGoveeApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * Govee device info from API
 */
interface IGoveeDeviceInfo {
  device: string;
  model: string;
  deviceName: string;
  controllable: boolean;
  retrievable: boolean;
  supportCmds: string[];
  properties: {
    online: boolean;
    powerState: 'on' | 'off';
    brightness?: number;
    color?: {
      r: number;
      g: number;
      b: number;
    };
  };
}

/**
 * Govee adapter configuration
 */
export interface IGoveeAdapterConfig extends IAdapterConfig {
  /** Govee API key */
  apiKey: string;
  /** API base URL (defaults to Govee's production API) */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Whether to enable request/response logging */
  debug?: boolean;
}

/**
 * Default Govee adapter configuration
 */
const DEFAULT_GOVEE_CONFIG: Partial<IGoveeAdapterConfig> = {
  type: 'govee',
  baseUrl: 'https://developer-api.govee.com/v1',
  timeout: 5000,
  debug: false,
};

/**
 * Govee light adapter implementation
 */
export class GoveeAdapter extends BaseLightAdapter {
  private readonly http: AxiosInstance;
  private readonly apiKey: string;

  constructor(config: IGoveeAdapterConfig) {
    // Merge with default config
    super({ ...DEFAULT_GOVEE_CONFIG, ...config } as IGoveeAdapterConfig);
    
    this.apiKey = config.apiKey;
    
    // Create HTTP client
    this.http = axios.create({
      baseURL: this.config.baseUrl as string,
      timeout: config.timeout || 5000,
      headers: {
        'Govee-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.http.interceptors.request.use(
      (config) => {
        if (this.config.debug) {
          this.logger.debug(`Request: ${config.method?.toUpperCase()} ${config.url}`, {
            method: config.method,
            url: config.url,
            data: config.data,
          });
        }
        return config;
      },
      (error) => {
        this.logger.error('Request error', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.http.interceptors.response.use(
      (response) => {
        if (this.config.debug) {
          this.logger.debug(`Response: ${response.status} ${response.config.url}`, {
            status: response.status,
            data: response.data,
          });
        }
        return response;
      },
      (error) => {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          this.logger.error('API Error Response', {
            status: error.response.status,
            data: error.response.data,
            headers: error.response.headers,
          });
        } else if (error.request) {
          // The request was made but no response was received
          this.logger.error('No response received', {
            request: error.request,
          });
        } else {
          // Something happened in setting up the request that triggered an Error
          this.logger.error('Request setup error', {
            message: error.message,
          });
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Initialize the Govee adapter
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Adapter already initialized');
      return;
    }

    this.logger.info('Initializing Govee adapter...');
    
    try {
      // Test API connectivity by fetching devices
      const devices = await this.getDevices();
      this.logger.info(`Successfully connected to Govee API. Found ${devices.length} devices.`);
      
      this.isInitialized = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to initialize Govee adapter', { error: message });
      throw new AdapterError(
        `Failed to initialize Govee adapter: ${message}`,
        'INITIALIZATION_FAILED',
        { cause: error }
      );
    }
  }

  /**
   * Get all Govee devices
   */
  public async getDevices(): Promise<IDevice[]> {
    this.logger.debug('Fetching Govee devices...');
    
    try {
      const response = await this.http.get<IGoveeApiResponse<{ devices: IGoveeDeviceInfo[] }>>('/devices');
      
      if (response.data.code !== 200) {
        throw new AdapterError(
          `Failed to fetch devices: ${response.data.message}`,
          'API_ERROR',
          { code: response.data.code }
        );
      }
      
      // Transform API response to IDevice format
      const devices = response.data.data.devices.map((deviceInfo) => 
        this.mapToDevice(deviceInfo)
      );
      
      // Update internal device cache
      this.updateDeviceCache(devices);
      
      return devices;
    } catch (error) {
      this.logger.error('Failed to fetch Govee devices', { error });
      throw new AdapterError(
        'Failed to fetch Govee devices',
        'DEVICE_FETCH_FAILED',
        { cause: error }
      );
    }
  }

  /**
   * Get a specific Govee device by ID
   */
  public async getDevice(deviceId: string): Promise<IDevice | null> {
    this.validateInitialized();
    
    try {
      // First check if we have a cached version
      if (this.devices.has(deviceId)) {
        return this.devices.get(deviceId)!;
      }
      
      // If not in cache, fetch all devices and try again
      await this.getDevices();
      return this.devices.get(deviceId) || null;
    } catch (error) {
      this.logger.error(`Failed to fetch device ${deviceId}`, { error });
      throw new AdapterError(
        `Failed to fetch device ${deviceId}`,
        'DEVICE_FETCH_FAILED',
        { deviceId, cause: error }
      );
    }
  }

  /**
   * Execute a light command
   */
  public async executeCommand(command: ILightCommand): Promise<void> {
    this.validateInitialized();
    this.validateDeviceId(command.deviceId);
    
    const device = this.devices.get(command.deviceId)! as IGoveeDevice;
    
    try {
      switch (command.type) {
        case 'turnOn':
          await this.setPowerState(device, true);
          break;
          
        case 'turnOff':
          await this.setPowerState(device, false);
          break;
          
        case 'setColor':
          if (!command.params.color) {
            throw new AdapterError(
              'Color parameter is required for setColor command',
              'INVALID_PARAMETER',
              { command }
            );
          }
          await this.setColor(device, command.params.color);
          break;
          
        case 'setBrightness':
          if (command.params.brightness === undefined) {
            throw new AdapterError(
              'Brightness parameter is required for setBrightness command',
              'INVALID_PARAMETER',
              { command }
            );
          }
          await this.setBrightness(device, command.params.brightness);
          break;
          
        default:
          this.logger.warn(`Unsupported command type: ${command.type}`, { command });
          throw new AdapterError(
            `Unsupported command type: ${command.type}`,
            'UNSUPPORTED_COMMAND',
            { command }
          );
      }
      
      // Refresh device state after command execution
      await this.refreshDeviceState(device);
      
    } catch (error) {
      this.logger.error(`Failed to execute command: ${command.type}`, { 
        deviceId: command.deviceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new AdapterError(
        `Failed to execute command: ${command.type}`,
        'COMMAND_EXECUTION_FAILED',
        { 
          command,
          cause: error 
        }
      );
    }
  }

  /**
   * Turn a device on or off
   */
  private async setPowerState(device: IGoveeDevice, powerOn: boolean): Promise<void> {
    const powerState = powerOn ? 'on' : 'off';
    this.logger.info(`Turning device ${powerState}: ${device.name} (${device.id})`);
    
    await this.sendDeviceCommand(device, {
      name: 'turn',
      value: powerState,
    });
    
    // Update local state
    this.updateDevice(device.id, { isOn: powerOn });
  }

  /**
   * Set device color
   */
  private async setColor(device: IGoveeDevice, hexColor: string): Promise<void> {
    this.logger.info(`Setting color for ${device.name} to ${hexColor}`);
    
    // Convert hex to RGB
    const rgb = this.hexToRgb(hexColor);
    if (!rgb) {
      throw new AdapterError(
        `Invalid hex color: ${hexColor}`,
        'INVALID_PARAMETER',
        { hexColor }
      );
    }
    
    await this.sendDeviceCommand(device, {
      name: 'color',
      value: rgb,
    });
    
    // Update local state
    this.updateDevice(device.id, { color: hexColor });
  }

  /**
   * Set device brightness
   */
  private async setBrightness(device: IGoveeDevice, brightness: number): Promise<void> {
    // Ensure brightness is within valid range (0-100)
    const clampedBrightness = Math.max(0, Math.min(100, brightness));
    
    this.logger.info(`Setting brightness for ${device.name} to ${clampedBrightness}%`);
    
    await this.sendDeviceCommand(device, {
      name: 'brightness',
      value: clampedBrightness,
    });
    
    // Update local state
    this.updateDevice(device.id, { brightness: clampedBrightness });
  }

  /**
   * Send a command to a Govee device
   */
  private async sendDeviceCommand(
    device: IGoveeDevice,
    command: { name: string; value: unknown }
  ): Promise<void> {
    try {
      const response = await this.http.put<IGoveeApiResponse<unknown>>(
        `/devices/control`,
        {
          device: device.address,
          model: device.model,
          cmd: {
            [command.name]: command.value,
          },
        }
      );
      
      if (response.data.code !== 200) {
        throw new AdapterError(
          `Failed to send command to device: ${response.data.message}`,
          'COMMAND_FAILED',
          { 
            deviceId: device.id,
            command,
            code: response.data.code 
          }
        );
      }
      
      this.logger.debug(`Command executed successfully`, { 
        deviceId: device.id,
        command,
      });
      
    } catch (error) {
      this.logger.error(`Failed to send command to device ${device.id}`, { 
        deviceId: device.id,
        command,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new AdapterError(
        `Failed to send command to device: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'COMMAND_SEND_FAILED',
        { 
          deviceId: device.id,
          command,
          cause: error 
        }
      );
    }
  }

  /**
   * Refresh the state of a device from the API
   */
  private async refreshDeviceState(device: IGoveeDevice): Promise<void> {
    try {
      const response = await this.http.get<IGoveeApiResponse<{ properties: any }>>(
        `/devices/state`,
        {
          params: {
            device: device.address,
            model: device.model,
          },
        }
      );
      
      if (response.data.code === 200) {
        const state = response.data.data.properties;
        this.updateDevice(device.id, {
          isOn: state.powerState === 'on',
          brightness: state.brightness,
          color: state.color ? this.rgbToHex(state.color) : undefined,
        });
      }
    } catch (error) {
      this.logger.warn(`Failed to refresh state for device ${device.id}`, { 
        deviceId: device.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw, as this is a non-critical operation
    }
  }

  /**
   * Map Govee device info to our IDevice interface
   */
  private mapToDevice(deviceInfo: IGoveeDeviceInfo): IGoveeDevice {
    return {
      id: deviceInfo.device,
      name: deviceInfo.deviceName,
      type: 'light', // Default type
      brand: 'govee',
      model: deviceInfo.model,
      address: deviceInfo.device,
      isOn: deviceInfo.properties.powerState === 'on',
      brightness: deviceInfo.properties.brightness,
      color: deviceInfo.properties.color ? this.rgbToHex(deviceInfo.properties.color) : undefined,
      isReachable: deviceInfo.properties.online,
      isOnline: deviceInfo.properties.online,
      isControllable: deviceInfo.controllable,
      isRetrievable: deviceInfo.retrievable,
      supportCmds: deviceInfo.supportCmds,
      version: '1.0', // Default version
      metadata: {
        ...deviceInfo,
      },
    };
  }

  /**
   * Update the internal device cache
   */
  private updateDeviceCache(devices: IDevice[]): void {
    for (const device of devices) {
      this.devices.set(device.id, device);
    }
  }

  /**
   * Update a device in the cache
   */
  private updateDevice(deviceId: string, updates: Partial<IDevice>): void {
    const device = this.devices.get(deviceId);
    if (device) {
      this.devices.set(deviceId, { ...device, ...updates });
    }
  }

  /**
   * Convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    // Remove # if present
    const hexValue = hex.replace('#', '');
    
    // Parse hex to RGB
    const bigint = parseInt(hexValue, 16);
    if (isNaN(bigint)) return null;
    
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255,
    };
  }

  /**
   * Convert RGB to hex color
   */
  private rgbToHex(rgb: { r: number; g: number; b: number }): string {
    return `#${((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1)}`;
  }
}

/**
 * Create a new Govee adapter instance
 */
export function createGoveeAdapter(config: IGoveeAdapterConfig): GoveeAdapter {
  return new GoveeAdapter({
    ...DEFAULT_GOVEE_CONFIG,
    ...config,
  });
}
