import { ILightCommand, IAdapterConfig } from '../../interfaces/device.interface';

export interface IDivinaL3AdapterConfig extends IAdapterConfig {
  /** Base URL for Divina-L3 API */
  baseUrl?: string;
  
  /** Authentication token for Divina-L3 API */
  authToken?: string;
  
  /** Whether to enable real-time sync */
  enableRealtimeSync?: boolean;
  
  /** Reconnection attempts for WebSocket */
  reconnectAttempts?: number;
}

export interface IDivinaProfile {
  id: string;
  userId: string;
  name: string;
  ambience: {
    lighting: {
      color?: string;
      brightness?: number;
      effect?: string;
    };
    mood: string;
    ritual?: string;
  };
  devices: Array<{
    id: string;
    type: string;
    name: string;
    state: Record<string, unknown>;
  }>;
  updatedAt: string;
}

export interface IDivinaRoom {
  id: string;
  name: string;
  profileId: string;
  devices: string[];
  active: boolean;
}

export interface IDivinaSyncPayload {
  type: 'profile' | 'device' | 'room' | 'ritual';
  action: 'create' | 'update' | 'delete';
  data: IDivinaProfile | IDivinaRoom | Record<string, unknown>;
  timestamp: number;
}
