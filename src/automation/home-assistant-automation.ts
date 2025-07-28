import { BaseAutomation } from './base-automation';
import { IAutomationConfig, IAutomationCapabilities } from '../interfaces/automation.interface';
import { IDevice, ILightCommand } from '../interfaces/device.interface';
import { Logger } from '../utils/logger';
import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';

interface HomeAssistantEntity {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name: string;
    supported_features: number;
    brightness?: number;
    rgb_color?: [number, number, number];
    hs_color?: [number, number];
    color_temp?: number;
    min_mireds?: number;
    max_mireds?: number;
    effect_list?: string[];
    effect?: string;
    [key: string]: any;
  };
  last_changed: string;
  last_updated: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

interface HomeAssistantEvent {
  event_type: string;
  data: {
    entity_id: string;
    new_state: HomeAssistantEntity | null;
    old_state: HomeAssistantEntity | null;
  };
  origin: string;
  time_fired: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

/**
 * Home Assistant automation platform implementation
 */
export class HomeAssistantAutomation extends BaseAutomation {
  private client: AxiosInstance;
  private wsClient: WebSocket | null = null;
  private wsMessageId: number = 0;
  private wsCallbacks: Map<number, (result: any) => void> = new Map();
  private wsEventCallbacks: Map<string, (event: any) => void> = new Map();
  private entities: Map<string, HomeAssistantEntity> = new Map();
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  
  private readonly SUPPORT_BRIGHTNESS = 1;
  private readonly SUPPORT_COLOR = 16;
  private readonly SUPPORT_COLOR_TEMP = 2;
  private readonly SUPPORT_EFFECT = 4;
  private readonly SUPPORT_WHITE_VALUE = 128;

  constructor(config: Omit<IAutomationConfig, 'type'>) {
    const capabilities: IAutomationCapabilities = {
      voiceControl: true,
      deviceDiscovery: true,
      sceneManagement: true,
      scheduling: true,
      automationRules: true,
      remoteAccess: true,
    };

    super(
      'home-assistant',
      'Home Assistant',
      capabilities,
      {
        ...config,
        type: 'home-assistant',
      }
    );

    const baseURL = config.auth?.baseUrl as string || 'http://homeassistant.local:8123';
    const accessToken = config.auth?.accessToken as string;

    this.client = axios.create({
      baseURL: `${baseURL}/api`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async connect(): Promise<boolean> {
    try {
      if (!this.config.auth?.accessToken) {
        throw new Error('Access token is required for Home Assistant integration');
      }

      // Test the connection by fetching the configuration
      await this.client.get('/config');
      
      // Connect to the WebSocket API for real-time updates
      await this.connectWebSocket();
      
      this._isConnected = true;
      this.reconnectAttempts = 0;
      this.logger.info('Successfully connected to Home Assistant API');
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to Home Assistant:', error);
      this._isConnected = false;
      throw error;
    }
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const baseURL = this.config.auth?.baseUrl as string || 'http://homeassistant.local:8123';
      const wsUrl = baseURL.replace(/^http/, 'ws') + '/api/websocket';
      
      this.wsClient = new WebSocket(wsUrl);
      
      this.wsClient.on('open', async () => {
        this.logger.debug('WebSocket connection established');
        
        // Handle authentication
        this.wsClient?.on('message', (data: WebSocket.RawData) => {
          try {
            const message = JSON.parse(data.toString());
            
          if (message.type === 'auth_required') {
            // Send authentication
            this.wsClient?.send(JSON.stringify({
              type: 'auth',
              access_token: this.config.auth?.accessToken,
            }));
          } else if (message.type === 'auth_ok') {
            this.logger.debug('WebSocket authenticated successfully');
            this.setupWebSocketHandlers();
            resolve();
          } else if (message.type === 'auth_invalid') {
            reject(new Error('Authentication failed: ' + (message.message || 'Invalid access token')));
          }
        } catch (error) {
          this.logger.error('Error processing WebSocket message:', error);
        }
      });
      
      this.wsClient.on('error', (error) => {
        this.logger.error('WebSocket error:', error);
        if (!this._isConnected) {
          reject(error);
        }
        this.handleWebSocketError();
      });
      
      this.wsClient.on('close', () => {
        this.logger.debug('WebSocket connection closed');
        this.handleWebSocketError();
      });
    });
  }

  private setupWebSocketHandlers(): void {
    if (!this.wsClient) return;
    
    this.wsClient.on('message', (data: WebSocket.RawData) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Handle callbacks for specific message IDs
        if (message.id && this.wsCallbacks.has(message.id)) {
          const callback = this.wsCallbacks.get(message.id);
          if (callback) {
            callback(message);
            this.wsCallbacks.delete(message.id);
          }
        }
        
        // Handle state changed events
        if (message.type === 'event' && message.event) {
          this.handleEvent(message.event);
        }
      } catch (error) {
        this.logger.error('Error processing WebSocket message:', error);
      }
    });
    
    // Subscribe to state changes for all light entities
    this.sendWebSocketMessage({
      id: this.getNextMessageId(),
      type: 'subscribe_events',
      event_type: 'state_changed',
    });
  }
  
  private handleWebSocketError(): void {
    if (this._isConnected) {
      this._isConnected = false;
      this.logger.warn('WebSocket connection lost, attempting to reconnect...');
      this.reconnect();
    }
  }
  
  private reconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.logger.error('Max reconnection attempts reached, giving up');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    
    this.logger.debug(`Reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connectWebSocket();
        this._isConnected = true;
        this.reconnectAttempts = 0;
        this.logger.info('Successfully reconnected to Home Assistant');
      } catch (error) {
        this.logger.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
        this.reconnect();
      }
    }, delay);
  }
  
  private getNextMessageId(): number {
    return ++this.wsMessageId;
  }
  
  private sendWebSocketMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.wsClient || this.wsClient.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }
      
      const messageId = message.id || this.getNextMessageId();
      message.id = messageId;
      
      this.wsCallbacks.set(messageId, (response: any) => {
        if (response.type === 'result' && !response.success) {
          reject(new Error(response.error?.message || 'WebSocket command failed'));
        } else {
          resolve(response);
        }
      });
      
      this.wsClient.send(JSON.stringify(message));
      
      // Set a timeout for the response
      setTimeout(() => {
        if (this.wsCallbacks.has(messageId)) {
          this.wsCallbacks.delete(messageId);
          reject(new Error('WebSocket command timed out'));
        }
      }, 10000); // 10 second timeout
    });
  }
  
  private handleEvent(event: HomeAssistantEvent): void {
    if (event.event_type === 'state_changed' && event.data.entity_id.startsWith('light.')) {
      const entityId = event.data.entity_id;
      const newState = event.data.new_state;
      
      if (newState) {
        this.entities.set(entityId, newState);
        this.notifyDeviceUpdate(this.mapHomeAssistantEntityToDevice(newState));
      }
    }
  }

  async getDevices(): Promise<IDevice[]> {
    try {
      const response = await this.client.get<HomeAssistantEntity[]>('/states');
      const lightEntities = response.data.filter(entity => 
        entity.entity_id.startsWith('light.')
      );
      
      // Cache the entities
      lightEntities.forEach(entity => {
        this.entities.set(entity.entity_id, entity);
      });
      
      return lightEntities.map(entity => this.mapHomeAssistantEntityToDevice(entity));
    } catch (error) {
      this.logger.error('Failed to fetch Home Assistant devices:', error);
      throw error;
    }
  }

  async executeCommand(command: ILightCommand): Promise<boolean> {
    if (!this._isConnected) {
      throw new Error('Not connected to Home Assistant API');
    }

    const entityId = command.deviceId;
    
    try {
      switch (command.type) {
        case 'turnOn':
          await this.client.post(`/services/light/turn_on`, {
            entity_id: entityId,
          });
          break;
          
        case 'turnOff':
          await this.client.post(`/services/light/turn_off`, {
            entity_id: entityId,
          });
          break;
          
        case 'setBrightness':
          if (typeof command.params.brightness === 'number') {
            // Convert percentage (0-100) to Home Assistant's brightness scale (0-255)
            const brightness = Math.round((command.params.brightness / 100) * 255);
            await this.client.post(`/services/light/turn_on`, {
              entity_id: entityId,
              brightness: brightness,
            });
          }
          break;
          
        case 'setColor':
          if (command.params.color) {
            // Convert hex to RGB
            const hex = command.params.color.replace(/^#/, '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            
            await this.client.post(`/services/light/turn_on`, {
              entity_id: entityId,
              rgb_color: [r, g, b],
            });
          }
          break;
          
        default:
          throw new Error(`Unsupported command type: ${command.type}`);
      }
      
      // The WebSocket handler will update the device state when it receives the state change event
      return true;
      
    } catch (error) {
      this.logger.error(`Failed to execute command on device ${entityId}:`, error);
      throw error;
    }
  }
  
  private mapHomeAssistantEntityToDevice(entity: HomeAssistantEntity): IDevice {
    const attributes = entity.attributes || {};
    const supportedFeatures = attributes.supported_features || 0;
    
    // Determine the current color in hex format if available
    let color: string | undefined;
    if (attributes.rgb_color && Array.isArray(attributes.rgb_color) && attributes.rgb_color.length >= 3) {
      const [r, g, b] = attributes.rgb_color;
      color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    // Determine the current brightness as a percentage (0-100)
    let brightness: number | undefined;
    if (typeof attributes.brightness === 'number') {
      brightness = Math.round((attributes.brightness / 255) * 100);
    }
    
    return {
      id: entity.entity_id,
      name: attributes.friendly_name || entity.entity_id.replace('light.', '').replace(/_/g, ' '),
      type: 'light',
      brand: 'home-assistant',
      model: 'home-assistant-device',
      address: entity.entity_id,
      isOn: entity.state === 'on',
      brightness,
      color,
      isReachable: entity.state !== 'unavailable',
      capabilities: {
        power: true,
        brightness: (supportedFeatures & this.SUPPORT_BRIGHTNESS) !== 0,
        color: (supportedFeatures & this.SUPPORT_COLOR) !== 0,
        colorTemperature: (supportedFeatures & this.SUPPORT_COLOR_TEMP) !== 0,
        effects: (supportedFeatures & this.SUPPORT_EFFECT) !== 0,
      },
      metadata: {
        ...attributes,
        last_updated: entity.last_updated,
        last_changed: entity.last_changed,
      },
    };
  }
  
  /**
   * Call a Home Assistant service
   * @param domain The service domain (e.g., 'light', 'switch')
   * @param service The service name (e.g., 'turn_on', 'turn_off')
   * @param serviceData Optional service data
   */
  public async callService(
    domain: string,
    service: string,
    serviceData: Record<string, any> = {}
  ): Promise<any> {
    try {
      const response = await this.client.post(`/services/${domain}/${service}`, serviceData);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to call service ${domain}.${service}:`, error);
      throw error;
    }
  }
  
  /**
   * Fire an event in Home Assistant
   * @param eventType The event type
   * @param eventData Optional event data
   */
  public async fireEvent(
    eventType: string,
    eventData: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.client.post('/events/' + eventType, eventData);
    } catch (error) {
      this.logger.error(`Failed to fire event ${eventType}:`, error);
      throw error;
    }
  }
  
  /**
   * Render a Home Assistant template
   * @param template The template string to render
   */
  public async renderTemplate(template: string): Promise<string> {
    try {
      const response = await this.client.post('/template', { template });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to render template:', error);
      throw error;
    }
  }
  
  /**
   * Disconnect from Home Assistant
   */
  public async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
    
    await super.disconnect();
  }
}
