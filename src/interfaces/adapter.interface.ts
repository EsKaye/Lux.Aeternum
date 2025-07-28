import { IDevice, ILightCommand, ILightEvent } from './device.interface';
import { Logger } from '../utils/logger';

/**
 * Base error class for adapter-related errors
 */
export class AdapterError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'AdapterError';
    this.code = code;
    this.details = details;
    
    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AdapterError);
    }
  }
}

/**
 * Configuration for a light adapter
 */
export interface IAdapterConfig {
  /** Adapter type/identifier */
  type: string;
  /** Whether to enable debug logging */
  debug?: boolean;
  /** Custom logger instance to use */
  logger?: Logger;
  /** Additional adapter-specific options */
  [key: string]: any;
}

/**
 * Base interface for all light system adapters
 */
export interface ILightAdapter {
  /**
   * Initialize the adapter
   */
  initialize(): Promise<void>;

  /**
   * Get all available devices
   */
  getDevices(): Promise<IDevice[]>;

  /**
   * Get a specific device by ID
   */
  getDevice(deviceId: string): Promise<IDevice | null>;

  /**
   * Execute a light command
   */
  executeCommand(command: ILightCommand): Promise<void>;

  /**
   * Handle a light event
   */
  handleEvent(event: ILightEvent): Promise<void>;

  /**
   * Get the adapter configuration
   */
  getConfig(): IAdapterConfig;

  /**
   * Update the adapter configuration
   */
  updateConfig(config: Partial<IAdapterConfig>): Promise<void>;

  /**
   * Get the logger instance for this adapter
   */
  getLogger(): Logger;
}

/**
 * Abstract base class for light adapters
 */
export abstract class BaseLightAdapter implements ILightAdapter {
  protected config: IAdapterConfig;
  protected logger: Logger;
  protected devices: Map<string, IDevice> = new Map();
  protected isInitialized: boolean = false;

  constructor(config: IAdapterConfig) {
    this.config = { ...config };
    this.logger = new Logger(`adapter:${this.config.type}`);
  }

  public abstract initialize(): Promise<void>;
  public abstract getDevices(): Promise<IDevice[]>;
  public abstract getDevice(deviceId: string): Promise<IDevice | null>;
  public abstract executeCommand(command: ILightCommand): Promise<void>;

  public async handleEvent(event: ILightEvent): Promise<void> {
    this.logger.debug(`Received event: ${event.type}`, { event });
    // Default implementation does nothing, should be overridden by subclasses
  }

  public getConfig(): IAdapterConfig {
    return { ...this.config };
  }

  public async updateConfig(config: Partial<IAdapterConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    this.logger.info('Configuration updated', { config: this.config });
  }

  public getLogger(): Logger {
    return this.logger;
  }

  protected validateInitialized(): void {
    if (!this.isInitialized) {
      throw new AdapterError(
        'Adapter not initialized. Call initialize() first.',
        'NOT_INITIALIZED'
      );
    }
  }

  protected validateDeviceId(deviceId: string): void {
    if (!this.devices.has(deviceId)) {
      throw new AdapterError(
        `Device with ID '${deviceId}' not found`,
        'DEVICE_NOT_FOUND',
        { deviceId }
      );
    }
  }
}
