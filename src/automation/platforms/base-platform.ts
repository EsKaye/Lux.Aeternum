import { BaseAutomation } from '../base-automation';
import { IAutomationConfig, IAutomationCapabilities } from '../../interfaces/automation.interface';
import { IDevice, ILightCommand, ILightEvent } from '../../interfaces/device.interface';

/**
 * Base class for all platform-specific automation adapters
 * Provides common functionality and default implementations
 */
export abstract class BasePlatformAdapter extends BaseAutomation {
  /**
   * Create a new platform adapter instance
   * @param config Configuration for the platform
   */
  constructor(config: IAutomationConfig) {
    super();
    this.config = config;
  }

  /**
   * Platform-specific initialization
   */
  public abstract initialize(): Promise<void>;

  /**
   * Connect to the platform's API or service
   */
  public abstract connect(): Promise<boolean>;

  /**
   * Get all devices from the platform
   */
  public abstract getDevices(): Promise<IDevice[]>;

  /**
   * Execute a light command on the platform
   * @param command The command to execute
   */
  public abstract executeCommand(command: ILightCommand): Promise<boolean>;

  /**
   * Handle an incoming event from the platform
   * @param event The event to handle
   */
  public async handleEvent(event: ILightEvent): Promise<void> {
    // Default implementation just emits the event
    this.emit('event', event);
  }

  /**
   * Convert a platform-specific device to a standard IDevice
   * @param platformDevice The platform-specific device
   */
  protected abstract normalizeDevice(platformDevice: any): IDevice;

  /**
   * Convert a standard light command to a platform-specific command
   * @param command The standard light command
   */
  protected abstract toPlatformCommand(command: ILightCommand): any;

  /**
   * Convert a platform-specific event to a standard light event
   * @param platformEvent The platform-specific event
   */
  protected abstract toLightEvent(platformEvent: any): ILightEvent;
}
