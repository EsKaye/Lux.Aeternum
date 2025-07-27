import { EventEmitter } from 'events';
import { LightManager } from '../light-manager';
import { IDevice, ILightCommand, ILightEvent, IAdapterConfig } from '../interfaces/device.interface';
import { Logger } from '../utils/logger';

/**
 * GameDin event types
 */
export enum GameDinEventType {
  // Player events
  PLAYER_JOIN = 'player:join',
  PLAYER_LEAVE = 'player:leave',
  PLAYER_LEVEL_UP = 'player:levelUp',
  PLAYER_ACHIEVEMENT = 'player:achievement',
  
  // Match events
  MATCH_START = 'match:start',
  MATCH_END = 'match:end',
  MATCH_VICTORY = 'match:victory',
  MATCH_DEFEAT = 'match:defeat',
  
  // Game events
  GAME_EVENT = 'game:event',
  
  // Chat events
  CHAT_MESSAGE = 'chat:message',
  
  // Custom events
  CUSTOM_EVENT = 'custom:event',
}

/**
 * GameDin event payload structure
 */
export interface IGameDinEvent {
  type: GameDinEventType | string;
  playerId?: string;
  playerName?: string;
  matchId?: string;
  gameId?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

/**
 * Light effect configuration for GameDin events
 */
export interface IGameDinLightEffect {
  /** Event type to trigger this effect */
  eventType: GameDinEventType | string;
  
  /** Light command to execute */
  command: Omit<ILightCommand, 'deviceId'>;
  
  /** Optional condition function to determine if the effect should be applied */
  condition?: (event: IGameDinEvent) => boolean;
  
  /** Priority of this effect (higher = more important) */
  priority?: number;
  
  /** Duration of the effect in milliseconds (0 for permanent) */
  duration?: number;
  
  /** Whether to restore previous state after duration */
  restorePreviousState?: boolean;
}

/**
 * GameDin adapter configuration
 */
export interface IGameDinAdapterConfig extends IAdapterConfig {
  /** GameDin API key */
  apiKey?: string;
  
  /** GameDin API base URL */
  baseUrl?: string;
  
  /** Default light effects for GameDin events */
  defaultEffects?: IGameDinLightEffect[];
  
  /** Whether to enable default effects */
  enableDefaultEffects?: boolean;
}

/**
 * Default light effects for GameDin events
 */
const DEFAULT_EFFECTS: IGameDinLightEffect[] = [
  // Player joined
  {
    eventType: GameDinEventType.PLAYER_JOIN,
    command: {
      type: 'setColor',
      params: { color: '#00FF00' },
    },
    duration: 2000,
    restorePreviousState: true,
    priority: 1,
  },
  
  // Victory
  {
    eventType: GameDinEventType.MATCH_VICTORY,
    command: {
      type: 'setColor',
      params: { color: '#FFFF00' },
    },
    duration: 5000,
    priority: 10,
  },
  
  // Defeat
  {
    eventType: GameDinEventType.MATCH_DEFEAT,
    command: {
      type: 'setColor',
      params: { color: '#FF0000' },
    },
    duration: 5000,
    priority: 10,
  },
  
  // Level up
  {
    eventType: GameDinEventType.PLAYER_LEVEL_UP,
    command: {
      type: 'setColor',
      params: { color: '#9400D3' }, // Violet
    },
    duration: 3000,
    priority: 5,
  },
];

/**
 * GameDin adapter for syncing lights with GameDin Network events
 */
export class GameDinAdapter extends EventEmitter {
  private lightManager: LightManager;
  private config: Required<IGameDinAdapterConfig>;
  private logger: Logger;
  private effects: Map<string, IGameDinLightEffect[]> = new Map();
  private deviceStates: Map<string, { color?: string; brightness?: number }> = new Map();
  private activeEffects: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(lightManager: LightManager, config: IGameDinAdapterConfig = {}) {
    super();
    
    this.lightManager = lightManager;
    this.config = {
      type: 'gamedin',
      apiKey: config.apiKey || process.env.GAMEDIN_API_KEY || '',
      baseUrl: config.baseUrl || 'https://api.gamedin.network',
      defaultEffects: config.defaultEffects || DEFAULT_EFFECTS,
      enableDefaultEffects: config.enableDefaultEffects !== false, // true by default
      options: config.options || {},
    };
    
    this.logger = new Logger('GameDinAdapter');
    
    // Register default effects if enabled
    if (this.config.enableDefaultEffects) {
      this.registerDefaultEffects();
    }
  }
  
  /**
   * Initialize the GameDin adapter
   */
  public async initialize(): Promise<void> {
    this.logger.info('Initializing GameDin adapter...');
    
    try {
      // Initialize the light manager if not already initialized
      await this.lightManager.initialize();
      
      // Set up any additional initialization logic here
      // For example, connect to GameDin WebSocket, etc.
      
      this.logger.info('GameDin adapter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize GameDin adapter', { error });
      throw error;
    }
  }
  
  /**
   * Register default light effects
   */
  private registerDefaultEffects(): void {
    for (const effect of this.config.defaultEffects) {
      this.addEffect(effect);
    }
    this.logger.info(`Registered ${this.config.defaultEffects.length} default effects`);
  }
  
  /**
   * Add a new light effect for a GameDin event
   */
  public addEffect(effect: IGameDinLightEffect): void {
    const { eventType } = effect;
    
    if (!this.effects.has(eventType)) {
      this.effects.set(eventType, []);
    }
    
    const effects = this.effects.get(eventType)!;
    effects.push(effect);
    
    // Sort effects by priority (highest first)
    effects.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    this.logger.debug(`Added effect for event: ${eventType}`, { effect });
  }
  
  /**
   * Remove a light effect
   */
  public removeEffect(eventType: string, effectIndex: number): void {
    const effects = this.effects.get(eventType);
    if (effects && effects[effectIndex]) {
      effects.splice(effectIndex, 1);
      this.logger.debug(`Removed effect for event: ${eventType} at index ${effectIndex}`);
    }
  }
  
  /**
   * Handle a GameDin event
   */
  public async handleEvent(event: IGameDinEvent): Promise<void> {
    const { type: eventType } = event;
    this.logger.debug(`Processing GameDin event: ${eventType}`, { event });
    
    // Get all effects for this event type
    const effects = this.effects.get(eventType) || [];
    
    if (effects.length === 0) {
      this.logger.debug(`No effects registered for event type: ${eventType}`);
      return;
    }
    
    // Get all devices
    const devices = await this.lightManager.getDevices();
    
    // Apply effects to all devices
    for (const device of devices) {
      await this.applyEffectsToDevice(device, effects, event);
    }
  }
  
  /**
   * Apply effects to a specific device
   */
  private async applyEffectsToDevice(
    device: IDevice,
    effects: IGameDinLightEffect[],
    event: IGameDinEvent
  ): Promise<void> {
    const deviceId = device.id;
    
    // Find the first effect that meets the condition (if any)
    const effect = effects.find(eff => !eff.condition || eff.condition(event));
    
    if (!effect) {
      this.logger.debug(`No matching effects for device: ${deviceId}`, { event });
      return;
    }
    
    this.logger.debug(`Applying effect to device: ${deviceId}`, { effect, event });
    
    // Store current state if needed for restoration
    if (effect.restorePreviousState && !this.deviceStates.has(deviceId)) {
      this.deviceStates.set(deviceId, {
        color: device.color,
        brightness: device.brightness,
      });
    }
    
    // Clear any existing timeout for this device
    this.clearDeviceEffect(deviceId);
    
    try {
      // Execute the light command
      const command: ILightCommand = {
        ...effect.command,
        deviceId,
      };
      
      await this.lightManager.executeCommand(command);
      
      // Set up restoration if duration is specified
      if (effect.duration && effect.duration > 0) {
        const timeout = setTimeout(async () => {
          if (effect.restorePreviousState) {
            await this.restoreDeviceState(deviceId);
          }
          this.clearDeviceEffect(deviceId);
        }, effect.duration);
        
        this.activeEffects.set(deviceId, timeout);
      }
    } catch (error) {
      this.logger.error(`Failed to apply effect to device ${deviceId}`, { 
        error, 
        deviceId,
        effect,
      });
    }
  }
  
  /**
   * Restore a device to its previous state
   */
  private async restoreDeviceState(deviceId: string): Promise<void> {
    const state = this.deviceStates.get(deviceId);
    if (!state) return;
    
    try {
      if (state.color !== undefined) {
        await this.lightManager.setColor(deviceId, state.color);
      }
      
      if (state.brightness !== undefined) {
        await this.lightManager.setBrightness(deviceId, state.brightness);
      }
      
      this.deviceStates.delete(deviceId);
      this.logger.debug(`Restored previous state for device: ${deviceId}`);
    } catch (error) {
      this.logger.error(`Failed to restore state for device ${deviceId}`, { 
        error,
        deviceId,
        state,
      });
    }
  }
  
  /**
   * Clear an active effect for a device
   */
  private clearDeviceEffect(deviceId: string): void {
    const timeout = this.activeEffects.get(deviceId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeEffects.delete(deviceId);
    }
  }
  
  /**
   * Clean up resources
   */
  public async dispose(): Promise<void> {
    // Clear all timeouts
    for (const timeout of this.activeEffects.values()) {
      clearTimeout(timeout);
    }
    
    this.activeEffects.clear();
    this.deviceStates.clear();
    this.removeAllListeners();
    
    this.logger.info('GameDin adapter disposed');
  }
}

/**
 * Create a new GameDin adapter instance
 */
export function createGameDinAdapter(
  lightManager: LightManager,
  config: IGameDinAdapterConfig = {}
): GameDinAdapter {
  return new GameDinAdapter(lightManager, config);
}

export { GameDinEventType as EventType };

export default {
  GameDinAdapter,
  createGameDinAdapter,
  EventType: GameDinEventType,
};
