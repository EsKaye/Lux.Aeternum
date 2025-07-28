import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { IAutomationPlatform, IAutomationCapabilities, IAutomationConfig } from '../interfaces/automation.interface';
import { IDevice, ILightCommand, ILightEvent } from '../interfaces/device.interface';

export * from '../interfaces/automation.interface';

/**
 * Base class for all automation platform implementations
 * Provides common functionality and enforces the IAutomationPlatform interface
 */
export abstract class BaseAutomationPlatform extends EventEmitter implements IAutomationPlatform {
  // Required IAutomationPlatform properties
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly capabilities: IAutomationCapabilities;
  public abstract readonly config: IAutomationConfig;
  
  // Internal state
  protected _isConnected: boolean = false;
  protected _isReady: boolean = false;
  protected logger: Logger;
  
  // Event emitter for device updates
  protected deviceUpdateCallbacks: Array<(device: IDevice) => void> = [];
  
  constructor() {
    super();
    this.logger = new Logger(`Automation:${this.constructor.name}`);
  }

  // IAutomationPlatform implementation
  public get isConnected(): boolean {
    return this._isConnected;
  }

  public get isReady(): boolean {
    return this._isReady;
  }

  public abstract connect(): Promise<boolean>;
  
  public async disconnect(): Promise<void> {
    this._isConnected = false;
    this._isReady = false;
    this.logger.info('Disconnected');
    this.emit('disconnected');
  }
  
  public abstract initialize(): Promise<void>;
  public abstract getDevices(): Promise<IDevice[]>;
  
  public async getDevice(deviceId: string): Promise<IDevice | null> {
    const devices = await this.getDevices();
    return devices.find(device => device.id === deviceId) || null;
  }

  public abstract executeCommand(command: ILightCommand): Promise<boolean>;
  
  public async handleEvent(event: ILightEvent): Promise<void> {
    this.emit('event', event);
  }

  public async syncDevices(): Promise<IDevice[]> {
    return this.getDevices();
  }

  public onDeviceUpdate(callback: (device: IDevice) => void): void {
    this.deviceUpdateCallbacks.push(callback);
  }

  protected notifyDeviceUpdate(device: IDevice): void {
    for (const callback of this.deviceUpdateCallbacks) {
      try {
        callback(device);
      } catch (error) {
        this.logger.error('Error in device update callback:', error);
      }
    }
    this.emit('device:update', device);
  }

  // Helper method to convert color formats if needed
  protected convertColorToHex(color: string | number | { r: number; g: number; b: number }): string {
    if (typeof color === 'string') {
      // If it's already a hex color, return it
      if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
        return color;
      }
      // Handle other string formats if needed
      throw new Error(`Unsupported color format: ${color}`);
    } else if (typeof color === 'number') {
      // Convert number to hex
      return `#${color.toString(16).padStart(6, '0')}`;
    } else if (typeof color === 'object' && color !== null && 'r' in color && 'g' in color && 'b' in color) {
      // Convert RGB object to hex
      const { r, g, b } = color;
      return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
    }
    
    throw new Error(`Unsupported color format: ${JSON.stringify(color)}`);
  }

  // Helper method to normalize device data
  protected normalizeDevice(device: Partial<IDevice> & { id: string }): IDevice {
    return {
      id: device.id,
      name: device.name || `Device ${device.id}`,
      type: device.type || 'light',
      brand: device.brand || this.name.toLowerCase(),
      model: device.model || 'unknown',
      address: device.address || '',
      isOn: device.isOn || false,
      brightness: device.brightness,
      color: device.color,
      isReachable: device.isReachable ?? true,
      metadata: device.metadata || {}
    };
  }
}
