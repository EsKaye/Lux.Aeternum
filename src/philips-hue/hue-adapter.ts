import axios, { AxiosInstance } from 'axios';
import { BaseLightAdapter, AdapterError, IAdapterConfig } from '../interfaces/adapter.interface';
import { IDevice, ILightCommand } from '../interfaces/device.interface';
import { Logger } from '../utils/logger';

/**
 * Philips Hue device state
 */
interface IHueDeviceState {
  on: boolean;
  bri?: number; // Brightness (0-254)
  hue?: number; // Hue (0-65535)
  sat?: number; // Saturation (0-254)
  xy?: [number, number]; // CIE color space coordinates
  ct?: number; // Color temperature (153-500)
  alert?: 'none' | 'select' | 'lselect';
  effect?: 'none' | 'colorloop';
  colormode?: 'hs' | 'xy' | 'ct';
  reachable: boolean;
}

/**
 * Philips Hue device info from the bridge
 */
interface IHueDeviceInfo {
  state: IHueDeviceState;
  type: string;
  name: string;
  modelid: string;
  manufacturername: string;
  uniqueid: string;
  swversion: string;
  swconfigid?: string;
  productid?: string;
  capabilities?: {
    certified: boolean;
    control: {
      mindimlevel?: number;
      maxlumen?: number;
      ct?: {
        min: number;
        max: number;
      };
    };
    streaming?: {
      renderer: boolean;
      proxy: boolean;
    };
  };
}

/**
 * Philips Hue bridge configuration
 */
interface IHueBridgeConfig {
  name: string;
  zigbeechannel: number;
  bridgeid: string;
  mac: string;
  dhcp: boolean;
  ipaddress: string;
  netmask: string;
  gateway: string;
  proxyaddress: string;
  proxyport: number;
  UTC: string;
  localtime: string;
  timezone: string;
  modelid: string;
  datastoreversion: string;
  swversion: string;
  apiversion: string;
  swupdate: {
    updatestate: number;
    checkforupdate: boolean;
    devicetypes: {
      bridge: boolean;
      lights: string[];
      sensors: string[];
    };
    url: string;
    text: string;
    notify: boolean;
  };
  linkbutton: boolean;
  portalservices: boolean;
  portalconnection: string;
  portalstate: {
    signedon: boolean;
    incoming: boolean;
    outgoing: boolean;
    communication: string;
  };
}

/**
 * Philips Hue adapter configuration
 */
export interface IPhilipsHueAdapterConfig extends IAdapterConfig {
  /** Bridge IP address */
  bridgeIp: string;
  /** Username for API access (if already authenticated) */
  username?: string;
  /** Client key for streaming API (optional) */
  clientKey?: string;
  /** Timeout for API requests in milliseconds */
  timeout?: number;
  /** Whether to use HTTPS */
  useHttps?: boolean;
  /** Port number (default: 80 for HTTP, 443 for HTTPS) */
  port?: number;
  /** Whether to enable debug logging */
  debug?: boolean;
  
  // Ensure type is set to 'philips-hue' for proper type narrowing
  type: 'philips-hue';
}

/**
 * Default Philips Hue adapter configuration
 */
const DEFAULT_PHILIPS_HUE_CONFIG: Omit<IPhilipsHueAdapterConfig, 'bridgeIp'> = {
  type: 'philips-hue',
  timeout: 5000,
  useHttps: false,
  debug: false,
  logger: undefined,
};

/**
 * Philips Hue light adapter implementation
 */
export class PhilipsHueAdapter extends BaseLightAdapter {
  private http: AxiosInstance;
  private bridgeIp: string;
  private username?: string;
  private clientKey?: string;
  private useHttps: boolean;
  private port?: number;
  private baseUrl: string;
  private authenticated: boolean = false;

  // The config property is already defined in the base class
  // We're just telling TypeScript about the specific type
  declare protected config: IPhilipsHueAdapterConfig;

  constructor(config: IPhilipsHueAdapterConfig) {
    // Merge with default config
    super({ ...DEFAULT_PHILIPS_HUE_CONFIG, ...config } as IPhilipsHueAdapterConfig);
    
    this.bridgeIp = config.bridgeIp;
    this.username = config.username;
    this.clientKey = config.clientKey;
    this.useHttps = config.useHttps || false;
    this.port = config.port;
    
    // Determine the base URL
    const protocol = this.useHttps ? 'https' : 'http';
    const port = this.port || (this.useHttps ? 443 : 80);
    this.baseUrl = `${protocol}://${this.bridgeIp}${port !== 80 && port !== 443 ? `:${port}` : ''}`;
    
    // Create HTTP client
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Add request interceptor for logging
    this.http.interceptors.request.use(
      (requestConfig) => {
        if (this.config.debug) {
          this.logger.debug(`Request: ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`, {
            method: requestConfig.method,
            url: requestConfig.url,
            data: requestConfig.data,
          });
        }
        return requestConfig;
      },
      (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Request error', { error: errorMessage });
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
      (error: unknown) => {
        if (axios.isAxiosError(error)) {
          if (error.response) {
            this.logger.error('API Error Response', {
              status: error.response.status,
              data: error.response.data,
              headers: error.response.headers,
            });
          } else if (error.request) {
            this.logger.error('No response received', {
              request: error.request,
            });
          } else {
            this.logger.error('Request setup error', {
              message: error.message,
            });
          }
        } else {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error('Unexpected error', { error: errorMessage });
        }
        return Promise.reject(error);
      }
    );
    
    // Set authenticated flag if username is provided
    this.authenticated = !!this.username;
  }
  
  /**
   * Initialize the Philips Hue adapter
   */
  public async initialize(): Promise<void> {
    this.logger.debug('PhilipsHueAdapter.initialize() called', { isInitialized: this.isInitialized });
    
    if (this.isInitialized) {
      this.logger.warn('Adapter already initialized');
      return;
    }

    this.logger.info('Initializing Philips Hue adapter...');
    
    try {
      // Initialize base adapter state
      this.isInitialized = false;
      this.logger.debug('Reset isInitialized flag');
      
      // Check if we need to authenticate
      if (!this.authenticated) {
        this.logger.warn('No username provided. You may need to authenticate with the bridge first.');
      } else {
        this.logger.debug('Using existing username for authentication');
      }
      
      // Test connection to the bridge
      this.logger.debug('Testing bridge connection with getBridgeConfig()');
      const bridgeConfig = await this.getBridgeConfig();
      this.logger.debug('Successfully retrieved bridge config', { 
        bridgeName: bridgeConfig.name,
        modelId: bridgeConfig.modelid,
        apiVersion: bridgeConfig.apiversion
      });
      
      // If we have a username, verify it works
      if (this.username) {
        this.logger.debug('Verifying username by fetching devices');
        const devices = await this.getDevices();
        this.logger.info('Successfully connected to Philips Hue bridge', { 
          deviceCount: devices.length,
          deviceIds: devices.map(d => d.id)
        });
      } else {
        this.logger.warn('Connected to bridge but not authenticated. Call createUser() to authenticate.');
      }
      
      // Mark as initialized only after all checks pass
      this.isInitialized = true;
      this.logger.debug('Philips Hue adapter initialized successfully');
    } catch (error) {
      this.isInitialized = false;
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      
      this.logger.error('Failed to initialize Philips Hue adapter', { 
        error: message,
        stack,
        errorObject: error
      });
      
      throw new AdapterError(
        `Failed to initialize Philips Hue adapter: ${message}`,
        'INITIALIZATION_FAILED',
        { 
          cause: error,
          isInitialized: this.isInitialized,
          authenticated: this.authenticated,
          hasUsername: !!this.username
        }
      );
    }
  }
  
  /**
   * Create a new user on the Philips Hue bridge
   * @param deviceType A unique identifier for your application
   * @returns The generated username
   */
  public async createUser(deviceType: string = 'lux-aeternum#app'): Promise<string> {
    this.logger.info('Creating new user on Philips Hue bridge. Please press the link button on the bridge...');
    
    try {
      const response = await this.http.post<[{
        success?: { username: string };
        error?: { type: number; address: string; description: string };
      }]>('/api', { devicetype: deviceType });
      
      const result = response.data[0];
      
      if (result.success) {
        this.username = result.success.username;
        this.authenticated = true;
        this.logger.info('Successfully created user on Philips Hue bridge');
        return this.username;
      } else if (result.error) {
        if (result.error.type === 101) {
          throw new AdapterError(
            'Link button not pressed. Please press the link button on the Philips Hue bridge and try again.',
            'LINK_BUTTON_NOT_PRESSED',
            { error: result.error }
          );
        } else {
          throw new AdapterError(
            `Failed to create user: ${result.error.description}`,
            'USER_CREATION_FAILED',
            { error: result.error }
          );
        }
      } else {
        throw new AdapterError(
          'Unexpected response from Philips Hue bridge',
          'UNEXPECTED_RESPONSE',
          { response: result }
        );
      }
    } catch (error) {
      this.logger.error('Failed to create user on Philips Hue bridge', { error });
      throw new AdapterError(
        'Failed to create user on Philips Hue bridge',
        'USER_CREATION_FAILED',
        { cause: error }
      );
    }
  }
  
  /**
   * Get bridge configuration
   */
  public async getBridgeConfig(): Promise<IHueBridgeConfig> {
    try {
      const response = await this.http.get<IHueBridgeConfig>('/api/config');
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get bridge configuration', { error });
      throw new AdapterError(
        'Failed to get bridge configuration',
        'BRIDGE_CONFIG_FAILED',
        { cause: error }
      );
    }
  }
  
  /**
   * Get all devices from the bridge
   */
  public async getDevices(): Promise<IDevice[]> {
    this.validateInitialized();
    
    if (!this.username) {
      throw new AdapterError(
        'Not authenticated. Call createUser() first.',
        'NOT_AUTHENTICATED'
      );
    }
    
    try {
      const response = await this.http.get<Record<string, IHueDeviceInfo>>(`/api/${this.username}/lights`);
      const devices: IDevice[] = [];
      
      for (const [id, deviceInfo] of Object.entries(response.data)) {
        const device = this.mapToDevice(id, deviceInfo);
        devices.push(device);
        // Update device cache
        this.devices.set(device.id, device);
      }
      
      return devices;
    } catch (error) {
      this.logger.error('Failed to get devices from Philips Hue bridge', { error });
      throw new AdapterError(
        'Failed to get devices from Philips Hue bridge',
        'DEVICE_FETCH_FAILED',
        { cause: error }
      );
    }
  }
  
  /**
   * Get a specific device by ID
   */
  public async getDevice(deviceId: string): Promise<IDevice | null> {
    this.validateInitialized();
    
    if (!this.username) {
      throw new AdapterError(
        'Not authenticated. Call createUser() first.',
        'NOT_AUTHENTICATED'
      );
    }
    
    // First check if we have a cached version
    if (this.devices.has(deviceId)) {
      return this.devices.get(deviceId)!;
    }
    
    try {
      const response = await this.http.get<IHueDeviceInfo>(`/api/${this.username}/lights/${deviceId}`);
      const device = this.mapToDevice(deviceId, response.data);
      
      // Update cache
      this.devices.set(device.id, device);
      
      return device;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null; // Device not found
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get device ${deviceId} from Philips Hue bridge`, { error: errorMessage });
      throw new AdapterError(
        `Failed to get device ${deviceId} from Philips Hue bridge: ${errorMessage}`,
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
    
    if (!this.username) {
      throw new AdapterError(
        'Not authenticated. Call createUser() first.',
        'NOT_AUTHENTICATED'
      );
    }
    
    const device = this.devices.get(command.deviceId)!;
    
    try {
      let state: Partial<IHueDeviceState> = {};
      
      switch (command.type) {
        case 'turnOn':
          state = { on: true };
          break;
          
        case 'turnOff':
          state = { on: false };
          break;
          
        case 'setColor':
          if (!command.params.color) {
            throw new AdapterError(
              'Color parameter is required for setColor command',
              'INVALID_PARAMETER',
              { command }
            );
          }
          
          // Convert hex to XY color (simplified, in a real app you'd want a proper conversion)
          const rgb = this.hexToRgb(command.params.color);
          if (!rgb) {
            throw new AdapterError(
              `Invalid hex color: ${command.params.color}`,
              'INVALID_PARAMETER',
              { command }
            );
          }
          
          // For simplicity, we'll use the RGB to XY conversion here
          // In a real implementation, you'd want to use the full conversion algorithm
          // that takes into account the color gamut of the specific light
          state = {
            on: true,
            xy: this.rgbToXy(rgb.r, rgb.g, rgb.b),
            colormode: 'xy',
          };
          break;
          
        case 'setBrightness':
          if (command.params.brightness === undefined) {
            throw new AdapterError(
              'Brightness parameter is required for setBrightness command',
              'INVALID_PARAMETER',
              { command }
            );
          }
          
          // Convert percentage (0-100) to Hue brightness (0-254)
          const brightness = Math.round((command.params.brightness / 100) * 254);
          state = {
            on: command.params.brightness > 0,
            bri: Math.max(0, Math.min(254, brightness)),
          };
          break;
          
        default:
          this.logger.warn(`Unsupported command type: ${command.type}`, { command });
          throw new AdapterError(
            `Unsupported command type: ${command.type}`,
            'UNSUPPORTED_COMMAND',
            { command }
          );
      }
      
      // Send the command to the bridge
      await this.setLightState(command.deviceId, state);
      
      // Update local state
      if (state.on !== undefined) {
        device.isOn = state.on;
      }
      
      if (state.bri !== undefined) {
        device.brightness = Math.round((state.bri / 254) * 100);
      }
      
      if (state.xy && command.params.color) {
        device.color = command.params.color;
      }
      
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
   * Set the state of a light
   */
  private async setLightState(deviceId: string, state: Partial<IHueDeviceState>): Promise<void> {
    try {
      await this.http.put(
        `/api/${this.username}/lights/${deviceId}/state`,
        state
      );
      
      this.logger.debug('Light state updated', { deviceId, state });
    } catch (error) {
      this.logger.error('Failed to set light state', { deviceId, state, error });
      throw new AdapterError(
        'Failed to set light state',
        'SET_STATE_FAILED',
        { deviceId, state, cause: error }
      );
    }
  }
  
  /**
   * Map Philips Hue device info to our IDevice interface
   */
  private mapToDevice(id: string, deviceInfo: IHueDeviceInfo): IDevice {
    // Convert XY color to hex if available
    let color: string | undefined;
    if (deviceInfo.state.xy) {
      // This is a simplified conversion - in a real app you'd want to handle
      // the full color gamut conversion based on the light's capabilities
      const [x, y] = deviceInfo.state.xy;
      const bri = deviceInfo.state.bri || 254; // Default to full brightness
      color = this.xyBriToHex(x, y, bri);
    } else if (deviceInfo.state.ct) {
      // Convert color temperature to a white color
      color = this.ctToHex(deviceInfo.state.ct);
    }
    
    return {
      id,
      name: deviceInfo.name,
      type: 'light',
      brand: 'philips',
      model: deviceInfo.modelid,
      address: deviceInfo.uniqueid,
      isOn: deviceInfo.state.on,
      brightness: deviceInfo.state.bri ? Math.round((deviceInfo.state.bri / 254) * 100) : undefined,
      color,
      isReachable: deviceInfo.state.reachable,
      metadata: {
        ...deviceInfo,
      },
    };
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
    
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    
    return { r, g, b };
  }
  
  /**
   * Convert RGB to CIE XY color space (simplified)
   * This is a placeholder - in a real app you'd want to use the full algorithm
   * that takes into account the specific color gamut of each light
   */
  private rgbToXy(r: number, g: number, b: number): [number, number] {
    // Simple RGB to XY conversion (not color-accurate)
    // In a real implementation, you'd want to use the full algorithm
    // that takes into account the color gamut of the specific light
    
    // Normalize RGB values
    const normalizedR = r / 255;
    const normalizedG = g / 255;
    const normalizedB = b / 255;
    
    // Apply gamma correction
    const gammaCorrectedR = this.gammaCorrection(normalizedR);
    const gammaCorrectedG = this.gammaCorrection(normalizedG);
    const gammaCorrectedB = this.gammaCorrection(normalizedB);
    
    // Convert to XYZ color space (simplified)
    const X = gammaCorrectedR * 0.644360 + gammaCorrectedG * 0.192800 + gammaCorrectedB * 0.162800;
    const Y = gammaCorrectedR * 0.326970 + gammaCorrectedG * 0.680600 + gammaCorrectedB * 0.142600;
    const Z = gammaCorrectedR * 0.000000 + gammaCorrectedG * 0.028100 + gammaCorrectedB * 1.063000;
    
    // Calculate xy from XYZ
    const sum = X + Y + Z;
    if (sum === 0) return [0, 0];
    
    const x = X / sum;
    const y = Y / sum;
    
    return [x, y];
  }
  
  /**
   * Apply gamma correction to a color channel
   */
  private gammaCorrection(value: number): number {
    return value > 0.04045 ? Math.pow((value + 0.055) / (1.0 + 0.055), 2.4) : value / 12.92;
  }
  
  /**
   * Convert XY and brightness to hex color (simplified)
   */
  private xyBriToHex(x: number, y: number, bri: number): string {
    // This is a simplified conversion - in a real app you'd want to handle
    // the full color gamut conversion based on the light's capabilities
    
    // Normalize brightness (0-1)
    const brightness = bri / 254;
    
    // Calculate XYZ from xy and brightness
    const Y = brightness;
    const X = (Y / y) * x;
    const Z = (Y / y) * (1 - x - y);
    
    // Convert to RGB (simplified)
    const r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
    const g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
    const b = X * 0.051713 - Y * 0.121364 + Z * 1.011530;
    
    // Apply gamma correction and clamp values
    const gammaCorrectedR = this.inverseGammaCorrection(r);
    const gammaCorrectedG = this.inverseGammaCorrection(g);
    const gammaCorrectedB = this.inverseGammaCorrection(b);
    
    // Clamp values to 0-255 and convert to hex
    const toHex = (value: number) => {
      const clamped = Math.max(0, Math.min(255, Math.round(value * 255)));
      return clamped.toString(16).padStart(2, '0');
    };
    
    return `#${toHex(gammaCorrectedR)}${toHex(gammaCorrectedG)}${toHex(gammaCorrectedB)}`;
  }
  
  /**
   * Apply inverse gamma correction to a color channel
   */
  private inverseGammaCorrection(value: number): number {
    return value <= 0.0031308 ? 12.92 * value : (1.0 + 0.055) * Math.pow(value, 1.0 / 2.4) - 0.055;
  }
  
  /**
   * Convert color temperature (mireds) to hex color (warm white to cool white)
   */
  private ctToHex(ct: number): string {
    // Convert mireds to kelvin (approximate)
    const kelvin = 1000000 / ct;
    
    // Clamp kelvin to a reasonable range
    const clampedKelvin = Math.max(2000, Math.min(6500, kelvin));
    
    // Convert kelvin to RGB (simplified)
    const temp = clampedKelvin / 100;
    let r, g, b;
    
    if (temp <= 66) {
      r = 255;
      g = temp - 2;
      g = -155.25485562709179 - 0.44596950469779147 * g + 104.49216199393888 * Math.log(g);
      b = temp <= 19 ? 0 : temp - 10;
      b = -254.76935184120902 + 0.8274096064007395 * b + 115.67994401066147 * Math.log(b);
    } else {
      r = temp - 55;
      r = 351.97690566805693 + 0.114206453784165 * r - 40.25366309332127 * Math.log(r);
      g = temp - 50;
      g = 325.4494125711974 + 0.07943456536662342 * g - 28.0852963507957 * Math.log(g);
      b = 255;
    }
    
    // Clamp values to 0-255
    const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
    
    // Convert to hex
    const toHex = (value: number) => clamp(value).toString(16).padStart(2, '0');
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}

/**
 * Create a new Philips Hue adapter instance
 */
export function createPhilipsHueAdapter(config: IPhilipsHueAdapterConfig): PhilipsHueAdapter {
  return new PhilipsHueAdapter({
    ...DEFAULT_PHILIPS_HUE_CONFIG,
    ...config,
  });
}
