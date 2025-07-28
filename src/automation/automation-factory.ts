import { IAutomationPlatform, IAutomationConfig } from '../interfaces/automation.interface';
import { Logger } from '../utils/logger';
import { BaseAutomationPlatform } from './base-automation';

// Import all automation platform implementations (these will be lazy-loaded)
type AutomationConstructor = new (config: IAutomationConfig) => IAutomationPlatform;

/**
 * Factory class for creating and managing automation platform instances
 */
export class AutomationFactory {
  private static registry: Map<string, () => Promise<{ default: AutomationConstructor }>> = new Map();
  private static logger = new Logger('AutomationFactory');
  private static isInitialized = false;

  /**
   * Initialize the factory with all available automation platforms
   */
  public static async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Register all available automation platforms with dynamic imports
      this.register('alexa', () => import('./platforms/alexa'));
      this.register('homekit', () => import('./platforms/homekit'));
      this.register('google-home', () => import('./platforms/google-home'));
      this.register('smartthings', () => import('./platforms/smartthings'));
      this.register('ifttt', () => import('./platforms/ifttt'));
      this.register('home-assistant', () => import('./platforms/home-assistant'));
      
      this.isInitialized = true;
      this.logger.info('Automation factory initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to initialize automation factory:', { error: errorMessage });
      throw new Error(`Failed to initialize automation factory: ${errorMessage}`);
    }
  }

  /**
   * Register an automation platform with the factory
   * @param type The type identifier for the platform
   * @param importFn Function that returns a promise resolving to the platform module
   */
  public static register(
    type: string,
    importFn: () => Promise<{ default: AutomationConstructor }>
  ): void {
    if (!type || !importFn) {
      throw new Error('Type and import function are required');
    }
    
    if (this.registry.has(type)) {
      this.logger.warn(`Automation platform '${type}' is already registered and will be overwritten`);
    }
    
    this.registry.set(type, importFn);
    this.logger.debug(`Registered automation platform: ${type}`);
  }

  /**
   * Create an instance of the specified automation platform
   * @param type The type of automation platform to create
   * @param config Configuration for the automation platform
   * @returns A promise that resolves to the created automation platform instance
   */
  public static async create(
    type: string,
    config: IAutomationConfig
  ): Promise<IAutomationPlatform> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const importFn = this.registry.get(type);
    if (!importFn) {
      const available = Array.from(this.registry.keys()).join(', ');
      throw new Error(
        `No automation platform found for type '${type}'. Available types: ${available}`
      );
    }

    try {
      this.logger.debug(`Creating automation platform instance: ${type}`);
      
      // Dynamically import the platform module
      const module = await importFn();
      const PlatformConstructor = module.default;
      
      // Create and initialize the platform instance
      const instance = new PlatformConstructor({
        ...config,
        type // Ensure type is set in config
      });
      
      await instance.initialize();
      this.logger.info(`Successfully initialized automation platform: ${type}`);
      return instance;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to initialize automation platform '${type}':`, { error: errorMessage });
      throw new Error(
        `Failed to initialize automation platform '${type}': ${errorMessage}`
      );
    }
  }

  /**
   * Get a list of all registered automation platform types
   * @returns An array of registered automation platform types
   */
  public static getAvailableTypes(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Get a list of supported platform types
   * @returns Array of supported platform type strings
   */
  /**
   * Get a list of supported platform types
   * @returns Array of supported platform type strings
   */
  static getSupportedPlatforms(): string[] {
    // Ensure registry is initialized
    if (Object.keys(this.platformRegistry).length === 0) {
      this.initializeRegistry();
    }
    return Object.keys(this.platformRegistry);
  }
  
  /**
   * Get the constructor for a specific platform type
   * @param type The platform type
   * @returns The platform constructor or undefined if not found
   */
  static getPlatformConstructor(type: string): AutomationConstructor | undefined {
    // Ensure registry is initialized
    if (Object.keys(this.platformRegistry).length === 0) {
      this.initializeRegistry();
    }
    return this.platformRegistry[type];
  }
}
