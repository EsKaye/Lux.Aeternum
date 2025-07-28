import { IDevice, ILightCommand, ILightEvent } from './device.interface';

/**
 * Represents the capabilities of an automation platform
 */
export interface IAutomationCapabilities {
  /** Whether the platform supports voice control */
  voiceControl: boolean;
  /** Whether the platform supports device discovery */
  deviceDiscovery: boolean;
  /** Whether the platform supports scene management */
  sceneManagement: boolean;
  /** Whether the platform supports scheduling */
  scheduling: boolean;
  /** Whether the platform supports automation rules */
  automationRules: boolean;
  /** Whether the platform supports remote access */
  remoteAccess: boolean;
  /** Custom capabilities */
  [key: string]: boolean | string | number | Record<string, unknown>;
}

/**
 * Configuration for an automation platform integration
 */
export interface IAutomationConfig {
  /** Platform type (e.g., 'alexa', 'homekit', 'google-home') */
  type: string;
  /** Authentication configuration */
  auth: {
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    [key: string]: unknown;
  };
  /** Platform-specific options */
  options?: Record<string, unknown>;
  /** Whether to enable the integration */
  enabled: boolean;
}

/**
 * Base interface for all automation platform integrations
 */
export interface IAutomationPlatform {
  /** Unique identifier for the platform */
  readonly id: string;
  /** Display name of the platform */
  readonly name: string;
  /** Platform capabilities */
  readonly capabilities: IAutomationCapabilities;
  /** Platform configuration */
  readonly config: IAutomationConfig;
  /** Whether the platform is connected */
  readonly isConnected: boolean;
  /** Whether the platform is ready */
  readonly isReady: boolean;

  /**
   * Initialize the platform
   */
  initialize(): Promise<void>;

  /**
   * Connect to the platform
   */
  connect(): Promise<boolean>;

  /**
   * Disconnect from the platform
   */
  disconnect(): Promise<void>;

  /**
   * Get all devices from the platform
   */
  getDevices(): Promise<IDevice[]>;

  /**
   * Get a specific device by ID
   * @param deviceId The device ID
   */
  getDevice(deviceId: string): Promise<IDevice | null>;

  /**
   * Execute a command on a device
   * @param command The command to execute
   */
  executeCommand(command: ILightCommand): Promise<boolean>;

  /**
   * Handle an event from the platform
   * @param event The event to handle
   */
  handleEvent(event: ILightEvent): Promise<void>;

  /**
   * Sync devices with the platform
   */
  syncDevices(): Promise<IDevice[]>;

  /**
   * Register a callback for device updates
   * @param callback The callback function
   */
  onDeviceUpdate(callback: (device: IDevice) => void): void;

  /**
   * Register a callback for platform events
   * @param event The event name
   * @param callback The callback function
   */
  on(event: string, callback: (data: unknown) => void): void;

  /**
   * Remove an event listener
   * @param event The event name
   * @param callback The callback function to remove
   */
  off(event: string, callback: (data: unknown) => void): void;
}
