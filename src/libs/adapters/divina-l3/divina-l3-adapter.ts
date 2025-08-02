import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import { LightManager } from '../../../light-manager';
import { IDevice, ILightCommand, ILightEvent, IAdapter, IAdapterConfig } from '../../../interfaces/device.interface';
import { Logger } from '../../../utils/logger';
import { IDivinaL3AdapterConfig, IDivinaProfile, IDivinaRoom, IDivinaSyncPayload } from './types';

/**
 * Divina-L3 Adapter for Lux Aeternum
 * Handles communication between Lux Aeternum and the Divina-L3 ecosystem
 */
export class DivinaL3Adapter extends EventEmitter implements IAdapter {
  private lightManager: LightManager;
  private config: Required<IDivinaL3AdapterConfig>;
  private http: AxiosInstance;
  private logger: Logger;
  private isInitialized: boolean = false;
  private ws: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private profileCache: Map<string, IDivinaProfile> = new Map();
  private roomCache: Map<string, IDivinaRoom> = new Map();

  constructor(lightManager: LightManager, config: IDivinaL3AdapterConfig = {}) {
    super();
    
    this.lightManager = lightManager;
    this.config = {
      type: 'divina-l3',
      baseUrl: config.baseUrl || 'https://api.divina-l3.com/v1',
      authToken: config.authToken || process.env.DIVINA_L3_AUTH_TOKEN || '',
      enableRealtimeSync: config.enableRealtimeSync ?? true,
      reconnectAttempts: config.reconnectAttempts || 5,
      options: config.options || {},
    };
    
    this.logger = new Logger('DivinaL3Adapter');
    this.maxReconnectAttempts = this.config.reconnectAttempts;
    
    // Initialize HTTP client
    this.http = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.config.authToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Initialize the adapter
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Adapter already initialized');
      return;
    }

    this.logger.info('Initializing Divina-L3 adapter...');
    
    try {
      // Initialize light manager if not already initialized
      await this.lightManager.initialize();
      
      // Connect to WebSocket for real-time updates if enabled
      if (this.config.enableRealtimeSync) {
        await this.connectWebSocket();
      }
      
      this.isInitialized = true;
      this.logger.info('Divina-L3 adapter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Divina-L3 adapter', { error });
      throw error;
    }
  }

  /**
   * Connect to Divina-L3 WebSocket for real-time updates
   */
  private async connectWebSocket(): Promise<void> {
    if (this.ws) {
      this.logger.warn('WebSocket already connected');
      return;
    }

    const wsUrl = this.config.baseUrl.replace(/^http/, 'ws') + '/realtime';
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.logger.info('Connected to Divina-L3 WebSocket');
        this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        
        // Authenticate with the WebSocket server
        this.ws?.send(JSON.stringify({
          type: 'auth',
          token: this.config.authToken,
        }));
      };
      
      this.ws.onmessage = (event) => this.handleWebSocketMessage(event);
      this.ws.onerror = (error) => this.handleWebSocketError(error);
      this.ws.onclose = () => this.handleWebSocketClose();
      
    } catch (error) {
      this.logger.error('WebSocket connection error', { error });
      this.scheduleReconnect();
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const data: IDivinaSyncPayload = JSON.parse(event.data);
      this.logger.debug('Received WebSocket message', { type: data.type, action: data.action });
      
      switch (data.type) {
        case 'profile':
          this.handleProfileUpdate(data as IDivinaProfile);
          break;
        case 'room':
          this.handleRoomUpdate(data as unknown as IDivinaRoom);
          break;
        case 'device':
          this.handleDeviceUpdate(data);
          break;
        case 'ritual':
          this.handleRitualUpdate(data);
          break;
        default:
          this.logger.warn('Unknown message type received', { type: data.type });
      }
    } catch (error) {
      this.logger.error('Error processing WebSocket message', { error });
    }
  }

  /**
   * Handle WebSocket errors
   */
  private handleWebSocketError(error: Event): void {
    this.logger.error('WebSocket error', { error });
  }

  /**
   * Handle WebSocket close event
   */
  private handleWebSocketClose(): void {
    this.logger.warn('WebSocket connection closed');
    this.ws = null;
    this.scheduleReconnect();
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached. Giving up.');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    
    this.logger.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connectWebSocket().catch(error => {
        this.logger.error('Reconnection attempt failed', { error });
      });
    }, delay);
  }

  /**
   * Handle profile updates from Divina-L3
   */
  private async handleProfileUpdate(profile: IDivinaProfile): Promise<void> {
    this.logger.info('Updating profile', { profileId: profile.id });
    this.profileCache.set(profile.id, profile);
    
    // Apply ambience settings to all devices in the profile
    if (profile.ambience?.lighting) {
      const { color, brightness, effect } = profile.ambience.lighting;
      
      // Get all devices for this profile
      const devices = await this.getDevices();
      
      // Apply settings to each device
      for (const device of devices) {
        const commands: ILightCommand[] = [];
        
        if (color) {
          commands.push({
            deviceId: device.id,
            type: 'setColor',
            params: { color },
          });
        }
        
        if (brightness !== undefined) {
          commands.push({
            deviceId: device.id,
            type: 'setBrightness',
            params: { brightness },
          });
        }
        
        if (effect) {
          commands.push({
            deviceId: device.id,
            type: 'setEffect',
            params: { effect },
          });
        }
        
        // Execute all commands
        for (const command of commands) {
          try {
            await this.executeCommand(command);
          } catch (error) {
            this.logger.error(`Failed to update device ${device.id}`, { error });
          }
        }
      }
    }
    
    // Emit event for any listeners
    this.emit('profile:updated', profile);
  }

  /**
   * Handle room updates from Divina-L3
   */
  private handleRoomUpdate(room: IDivinaRoom): void {
    this.logger.info('Updating room', { roomId: room.id });
    this.roomCache.set(room.id, room);
    this.emit('room:updated', room);
  }

  /**
   * Handle device updates from Divina-L3
   */
  private handleDeviceUpdate(payload: IDivinaSyncPayload): void {
    // TODO: Implement device update handling
    this.logger.debug('Device update received', payload);
    this.emit('device:updated', payload.data);
  }

  /**
   * Handle ritual updates from Divina-L3
   */
  private handleRitualUpdate(payload: IDivinaSyncPayload): void {
    // TODO: Implement ritual update handling
    this.logger.debug('Ritual update received', payload);
    this.emit('ritual:updated', payload.data);
  }

  /**
   * Get the adapter configuration
   */
  public getConfig(): IAdapterConfig {
    return this.config;
  }

  /**
   * Get all devices managed by this adapter
   */
  public async getDevices(): Promise<IDevice[]> {
    try {
      // In a real implementation, this would fetch devices from Divina-L3 API
      // For now, return an empty array
      return [];
    } catch (error) {
      this.logger.error('Failed to fetch devices', { error });
      throw error;
    }
  }

  /**
   * Get a specific device by ID
   */
  public async getDevice(deviceId: string): Promise<IDevice | null> {
    try {
      const devices = await this.getDevices();
      return devices.find(device => device.id === deviceId) || null;
    } catch (error) {
      this.logger.error(`Failed to fetch device ${deviceId}`, { error });
      throw error;
    }
  }

  /**
   * Execute a light command
   */
  public async executeCommand(command: ILightCommand): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Adapter not initialized');
    }

    try {
      // Forward the command to the light manager
      await this.lightManager.executeCommand(command);
      this.logger.debug('Command executed successfully', { command });
    } catch (error) {
      this.logger.error('Failed to execute command', { command, error });
      throw error;
    }
  }

  /**
   * Handle a light event
   */
  public async handleEvent(event: ILightEvent): Promise<void> {
    // Forward the event to Divina-L3 if needed
    this.logger.debug('Handling light event', { event });
    this.emit('event', event);
  }

  /**
   * Clean up resources
   */
  public async dispose(): Promise<void> {
    this.logger.info('Disposing Divina-L3 adapter...');
    
    // Clean up WebSocket connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Clear any pending reconnection attempts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.isInitialized = false;
    this.logger.info('Divina-L3 adapter disposed');
  }
}

/**
 * Create a new Divina-L3 adapter instance
 */
export function createDivinaL3Adapter(
  lightManager: LightManager,
  config: IDivinaL3AdapterConfig = {}
): DivinaL3Adapter {
  return new DivinaL3Adapter(lightManager, config);
}

export default {
  DivinaL3Adapter,
  createDivinaL3Adapter,
};
