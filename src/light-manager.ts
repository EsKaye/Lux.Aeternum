import { ILightAdapter, IDevice, ILightCommand, ILightEvent, IAdapterConfig } from './interfaces/device.interface';
import { GoveeAdapter, createGoveeAdapter } from './govee/govee-adapter';
import { Logger } from './utils/logger';

type AdapterType = 'govee' | 'philips-hue' | 'lifx' | string;

/**
 * Configuration for the LightManager
 */
export interface ILightManagerConfig {
  /** Whether to enable debug logging */
  debug?: boolean;
  /** Whether to automatically initialize adapters */
  autoInitialize?: boolean;
  /** Default adapter configurations */
  adapters?: IAdapterConfig[];
}

/**
 * Manages multiple light adapters and provides a unified interface
 */
export class LightManager {
  private adapters: Map<string, ILightAdapter> = new Map();
  private logger: Logger;
  private isInitialized: boolean = false;
  private config: Required<ILightManagerConfig>;

  constructor(config: ILightManagerConfig = {}) {
    this.config = {
      debug: config.debug || false,
      autoInitialize: config.autoInitialize !== false, // true by default
      adapters: config.adapters || [],
    };

    this.logger = new Logger('LightManager');
    
    // Set log level based on debug config
    if (this.config.debug) {
      process.env.LOG_LEVEL = 'debug';
      this.logger.info('Debug logging enabled');
    }
  }

  /**
   * Initialize the LightManager and all registered adapters
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('LightManager already initialized');
      return;
    }

    this.logger.info('Initializing LightManager...');

    try {
      // Initialize all registered adapters
      const initPromises = Array.from(this.adapters.values()).map(adapter => 
        adapter.initialize().catch(error => {
          this.logger.error(`Failed to initialize adapter: ${error.message}`, { error });
          // Don't throw, continue with other adapters
        })
      );

      await Promise.all(initPromises);
      
      this.isInitialized = true;
      this.logger.info('LightManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize LightManager', { error });
      throw new Error(`Failed to initialize LightManager: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add a new light adapter
   */
  public addAdapter(adapter: ILightAdapter): void {
    const config = adapter.getConfig();
    const adapterId = `${config.type}:${config.options?.id || Date.now()}`;
    
    if (this.adapters.has(adapterId)) {
      this.logger.warn(`Adapter with ID ${adapterId} already exists`);
      return;
    }
    
    this.adapters.set(adapterId, adapter);
    this.logger.info(`Added adapter: ${adapterId}`);
    
    // Auto-initialize if configured to do so
    if (this.config.autoInitialize && !this.isInitialized) {
      this.initialize().catch(error => {
        this.logger.error('Failed to auto-initialize after adding adapter', { error });
      });
    }
  }

  /**
   * Create and add a Govee adapter
   */
  public addGoveeAdapter(apiKey: string, options: Partial<IAdapterConfig> = {}): GoveeAdapter {
    const adapter = createGoveeAdapter({
      ...options,
      type: 'govee',
      apiKey,
    });
    
    this.addAdapter(adapter);
    return adapter;
  }

  /**
   * Get all devices from all adapters
   */
  public async getDevices(): Promise<IDevice[]> {
    const allDevices: IDevice[] = [];
    
    for (const [adapterId, adapter] of this.adapters.entries()) {
      try {
        const devices = await adapter.getDevices();
        allDevices.push(...devices);
      } catch (error) {
        this.logger.error(`Failed to get devices from adapter ${adapterId}`, { error });
      }
    }
    
    return allDevices;
  }

  /**
   * Get a device by ID
   */
  public async getDevice(deviceId: string): Promise<IDevice | null> {
    for (const adapter of this.adapters.values()) {
      try {
        const device = await adapter.getDevice(deviceId);
        if (device) return device;
      } catch (error) {
        // Log but continue to next adapter
        this.logger.debug(`Device ${deviceId} not found in adapter: ${adapter.getConfig().type}`);
      }
    }
    
    return null;
  }

  /**
   * Execute a light command
   */
  public async executeCommand(command: ILightCommand): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const device = await this.getDevice(command.deviceId);
    if (!device) {
      throw new Error(`Device not found: ${command.deviceId}`);
    }

    // Find the adapter that manages this device
    for (const adapter of this.adapters.values()) {
      try {
        await adapter.executeCommand(command);
        return; // Command executed successfully
      } catch (error) {
        this.logger.debug(`Command failed on adapter ${adapter.getConfig().type}`, { error });
        // Continue to next adapter
      }
    }
    
    throw new Error(`Failed to execute command on device ${command.deviceId}: No adapter could handle the command`);
  }

  /**
   * Handle a light event
   */
  public async handleEvent(event: ILightEvent): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.logger.debug(`Handling event: ${event.type}`);
    
    // Forward event to all adapters
    const eventPromises = Array.from(this.adapters.values()).map(adapter => 
      adapter.handleEvent(event).catch(error => {
        this.logger.error(`Error handling event in adapter: ${error.message}`, { error });
      })
    );
    
    await Promise.all(eventPromises);
  }

  /**
   * Turn on a device
   */
  public async turnOn(deviceId: string): Promise<void> {
    return this.executeCommand({
      type: 'turnOn',
      deviceId,
      params: {},
    });
  }

  /**
   * Turn off a device
   */
  public async turnOff(deviceId: string): Promise<void> {
    return this.executeCommand({
      type: 'turnOff',
      deviceId,
      params: {},
    });
  }

  /**
   * Set device color
   */
  public async setColor(deviceId: string, color: string): Promise<void> {
    return this.executeCommand({
      type: 'setColor',
      deviceId,
      params: { color },
    });
  }

  /**
   * Set device brightness
   */
  public async setBrightness(deviceId: string, brightness: number): Promise<void> {
    return this.executeCommand({
      type: 'setBrightness',
      deviceId,
      params: { brightness },
    });
  }

  /**
   * Get all registered adapters
   */
  public getAdapters(): Map<string, ILightAdapter> {
    return new Map(this.adapters);
  }
}

/**
 * Create a new LightManager instance
 */
export function createLightManager(config: ILightManagerConfig = {}): LightManager {
  return new LightManager(config);
}

export * from './interfaces/device.interface';
export * from './govee/govee-adapter';
