/**
 * Represents a basic light device with common properties
 */
export interface IDevice {
  /** Unique identifier for the device */
  id: string;
  /** Display name of the device */
  name: string;
  /** Type of the device (e.g., 'light', 'strip', 'lamp') */
  type: string;
  /** Brand of the device (e.g., 'govee', 'philips') */
  brand: string;
  /** Model identifier */
  model: string;
  /** MAC address or unique hardware identifier */
  address: string;
  /** Current power state */
  isOn: boolean;
  /** Current brightness (0-100) */
  brightness?: number;
  /** Current color in hex format (e.g., '#FF0000') */
  color?: string;
  /** Whether the device is currently reachable */
  isReachable: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Represents a command that can be sent to a light device
 */
export interface ILightCommand {
  /** Type of command (e.g., 'turnOn', 'setColor', 'setBrightness') */
  type: 'turnOn' | 'turnOff' | 'setColor' | 'setBrightness' | 'custom';
  /** Target device ID */
  deviceId: string;
  /** Command parameters */
  params: {
    color?: string;
    brightness?: number;
    effect?: string;
    [key: string]: unknown;
  };
  /** Optional timestamp for scheduling */
  timestamp?: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Represents an event that can trigger light changes
 */
export interface ILightEvent {
  /** Event type (e.g., 'gameEvent', 'discordMessage', 'emotionChange') */
  type: string;
  /** Event payload */
  payload: unknown;
  /** Timestamp of when the event occurred */
  timestamp: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

import { Logger } from '../utils/logger';

/**
 * Configuration for a light system adapter
 */
export interface IAdapterConfig {
  /** Adapter type (e.g., 'govee', 'philips-hue') */
  type: string;
  /** API key or authentication token */
  apiKey?: string;
  /** Base URL for the API */
  baseUrl?: string;
  /** Polling interval in milliseconds */
  pollInterval?: number;
  /** Additional configuration options */
  options?: Record<string, unknown>;
}
