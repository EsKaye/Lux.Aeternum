import { EventEmitter } from 'events';
import { BaseAutomation } from './base-automation';
import { IAutomationConfig, IAutomationCapabilities } from '../interfaces/automation.interface';
import { IDevice, ILightCommand, ILightEvent } from '../interfaces/device.interface';
import { Logger } from '../utils/logger';
import axios, { AxiosInstance } from 'axios';

interface IFTTTDevice {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
  lastSeen: string;
  connected: boolean;
}

interface IFTTTAction {
  action: string;
  device_id: string;
  [key: string]: any;
}

/**
 * IFTTT (If This Then That) automation platform implementation
 */
export class IFTTTAutomation extends BaseAutomation {
  private client: AxiosInstance;
  private devices: IFTTTDevice[] = [];
  private eventEmitter = new EventEmitter();

  // Implement required abstract properties
  public readonly id: string;
  public readonly name: string;
  public readonly capabilities: IAutomationCapabilities;
  public readonly config: IAutomationConfig;
  
  // Track connection state
  protected _isConnected: boolean = false;
  protected _isReady: boolean = false;
  
  // Logger instance
  protected logger: Logger;
  private client: AxiosInstance;
  private readonly API_BASE_URL = 'https://connect.ifttt.com/v1';
  private devices: IFTTTDevice[] = [];

  constructor(config: IAutomationConfig) {
    // Initialize the base class first
    super(
      'ifttt',
      'IFTTT',
      {
        voiceControl: false, // IFTTT doesn't directly support voice control
        deviceDiscovery: true,
        sceneManagement: true,
        scheduling: true,
        automationRules: true,
        remoteAccess: true,
      },
      config
    );
    
    // Initialize properties
    this.id = 'ifttt';
    this.name = 'IFTTT';
    this.capabilities = {
      voiceControl: false,
      deviceDiscovery: true,
      sceneManagement: true,
      scheduling: true,
      automationRules: true,
      remoteAccess: true,
    };
    this.config = config;
    this.logger = new Logger('IFTTT');

    this.client = axios.create({
      baseURL: 'https://connect.ifttt.com/v1',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.auth?.apiKey || ''}`,
      },
    });
  }

  async connect(): Promise<boolean> {
    try {
      if (!this.config.auth?.apiKey) {
        throw new Error('API key is required for IFTTT integration');
      }

      // Test the connection by fetching devices
      await this.getDevices();
      
      this._isConnected = true;
      this.logger.info('Successfully connected to IFTTT API');
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to IFTTT:', error);
      this._isConnected = false;
      throw error;
    }
  }
  
  // Implement abstract methods
  async initialize(): Promise<void> {
    await this.connect();
    this._isReady = true;
  }
  
  async handleEvent(event: ILightEvent): Promise<void> {
    this.eventEmitter.emit('event', event);
  }
  
  async syncDevices(): Promise<IDevice[]> {
    return this.getDevices();
  }
  
  onDeviceUpdate(callback: (device: IDevice) => void): void {
    this.eventEmitter.on('device:update', callback);
  }
  
  on(event: string, callback: (data: unknown) => void): void {
    this.eventEmitter.on(event, callback);
  }
  
  off(event: string, callback: (data: unknown) => void): void {
    this.eventEmitter.off(event, callback);
  }

  async getDevices(): Promise<IDevice[]> {
    try {
      // In a real implementation, we would query the IFTTT API for connected devices
      // This is a simplified example that returns mock data
      this.devices = [
        {
          id: 'ifttt-light-1',
          name: 'IFTTT Light',
          type: 'light',
          capabilities: ['turn_on', 'turn_off', 'set_brightness', 'set_color'],
          lastSeen: new Date().toISOString(),
          connected: true,
        },
      ];

      return this.mapIFTTTDevices(this.devices);
    } catch (error) {
      this.logger.error('Failed to fetch IFTTT devices:', error);
      throw error;
    }
  }

  async executeCommand(command: ILightCommand): Promise<boolean> {
    if (!this._isConnected) {
      throw new Error('Not connected to IFTTT API');
    }

    const deviceId = command.deviceId;
    const device = this.devices.find(d => d.id === deviceId);
    
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    try {
      let action: IFTTTAction | null = null;
      
      switch (command.type) {
        case 'turnOn':
          action = {
            action: 'turn_on',
            device_id: deviceId,
          };
          break;
          
        case 'turnOff':
          action = {
            action: 'turn_off',
            device_id: deviceId,
          };
          break;
          
        case 'setBrightness':
          if (typeof command.params.brightness === 'number') {
            action = {
              action: 'set_brightness',
              device_id: deviceId,
              brightness: command.params.brightness,
            };
          }
          break;
          
        case 'setColor':
          if (command.params.color) {
            action = {
              action: 'set_color',
              device_id: deviceId,
              color: command.params.color,
            };
          }
          break;
          
        default:
          throw new Error(`Unsupported command type: ${command.type}`);
      }

      if (action) {
        // In a real implementation, we would send the action to the IFTTT API
        // This is a simplified example that simulates the API call
        await this.sendIFTTTAction(action);
        
        // Update the local device state
        this.updateDeviceState(deviceId, command);
        return true;
      }
      
      return false;
      
    } catch (error) {
      this.logger.error(`Failed to execute command on device ${deviceId}:`, error);
      throw error;
    }
  }

  private async sendIFTTTAction(action: IFTTTAction): Promise<void> {
    try {
      // In a real implementation, this would send the action to the IFTTT API
      // For example:
      // await this.client.post('/actions', { action });
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      this.logger.info(`IFTTT action '${action.action}' executed for device ${action.device_id}`);
    } catch (error) {
      this.logger.error(`Failed to send IFTTT action '${action.action}':`, error);
      throw error;
    }
  }

  private updateDeviceState(deviceId: string, command: ILightCommand): void {
    const device = this.devices.find(d => d.id === deviceId);
    if (!device) return;

    // In a real implementation, we would update the device state based on the command
    // This is a simplified example that just logs the state change
    this.logger.info(`Device ${deviceId} state updated:`, command);
  }

  private mapIFTTTDevices(iftttDevices: IFTTTDevice[]): IDevice[] {
    return iftttDevices.map(device => ({
      id: device.id,
      name: device.name,
      type: device.type,
      brand: 'ifttt',
      model: 'ifttt-device',
      address: device.id,
      isOn: false, // Initial state, would be updated after first sync
      isReachable: device.connected,
      capabilities: {
        power: device.capabilities.includes('turn_on') && device.capabilities.includes('turn_off'),
        brightness: device.capabilities.includes('set_brightness'),
        color: device.capabilities.includes('set_color'),
      },
      metadata: {
        lastSeen: device.lastSeen,
        capabilities: device.capabilities,
      },
    }));
  }

  /**
   * Trigger an IFTTT webhook
   * @param eventName The name of the IFTTT event to trigger
   * @param value1 First optional value
   * @param value2 Second optional value
   * @param value3 Third optional value
   */
  public async triggerWebhook(
    eventName: string,
    value1?: string,
    value2?: string,
    value3?: string
  ): Promise<boolean> {
    if (!this._isConnected) {
      throw new Error('Not connected to IFTTT API');
    }

    try {
      const webhookKey = this.config.auth?.webhookKey || '';
      const url = `https://maker.ifttt.com/trigger/${eventName}/with/key/${webhookKey}`;
      
      const payload: any = {};
      if (value1 !== undefined) payload.value1 = value1;
      if (value2 !== undefined) payload.value2 = value2;
      if (value3 !== undefined) payload.value3 = value3;
      
      await axios.post(url, payload);
      
      this.logger.info(`IFTTT webhook '${eventName}' triggered successfully`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to trigger IFTTT webhook '${eventName}':`, error);
      throw error;
    }
  }
}
