/**
 * Environment Profile Model
 * 
 * Defines the structure for ambient/emotional state that can be synced
 * between Lux Aeternum, Divina-L3, and GameDin Network.
 */

export interface IAmbientLighting {
  /** Hex color code (e.g., #RRGGBB) */
  color?: string;
  
  /** Brightness percentage (0-100) */
  brightness?: number;
  
  /** Lighting effect name */
  effect?: string;
  
  /** Effect speed (0-100) */
  effectSpeed?: number;
  
  /** Transition duration in milliseconds */
  transition?: number;
}

export interface IAmbientSound {
  /** Soundtrack or soundscape ID */
  trackId?: string;
  
  /** Volume level (0-100) */
  volume?: number;
  
  /** Whether to loop the sound */
  loop?: boolean;
  
  /** Fade in/out duration in milliseconds */
  fade?: number;
}

export interface IEmotionalState {
  /** Primary emotion (e.g., 'calm', 'energized', 'focused') */
  primary: string;
  
  /** Secondary emotion (optional) */
  secondary?: string;
  
  /** Intensity of the emotional state (0-100) */
  intensity: number;
  
  /** Timestamp of when this state was recorded */
  timestamp?: Date;
}

export interface IRitual {
  /** Unique identifier for the ritual */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Description of the ritual */
  description?: string;
  
  /** Duration in milliseconds (0 for indefinite) */
  duration: number;
  
  /** Whether this ritual is active */
  active: boolean;
  
  /** Timestamp when the ritual was started */
  startedAt?: Date;
  
  /** Timestamp when the ritual will end (if duration > 0) */
  endsAt?: Date;
}

export interface IEnvironmentProfile {
  /** Unique identifier for the profile */
  id: string;
  
  /** User ID this profile belongs to */
  userId: string;
  
  /** Display name */
  name: string;
  
  /** Whether this is the active profile */
  active: boolean;
  
  /** Lighting configuration */
  lighting: IAmbientLighting;
  
  /** Sound configuration */
  sound?: IAmbientSound;
  
  /** Current emotional state */
  mood: IEmotionalState;
  
  /** Active ritual (if any) */
  activeRitual?: IRitual;
  
  /** Device-specific overrides */
  deviceOverrides?: Record<string, {
    lighting?: Partial<IAmbientLighting>;
    sound?: Partial<IAmbientSound>;
  }>;
  
  /** Timestamp when this profile was created */
  createdAt: Date;
  
  /** Timestamp when this profile was last updated */
  updatedAt: Date;
}

/**
 * Default environment profile
 */
export const DEFAULT_ENV_PROFILE: IEnvironmentProfile = {
  id: 'default',
  userId: 'system',
  name: 'Default Profile',
  active: true,
  lighting: {
    color: '#FFFFFF',
    brightness: 70,
    effect: 'solid',
    effectSpeed: 50,
    transition: 500,
  },
  mood: {
    primary: 'neutral',
    intensity: 50,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Convert a Divina-L3 profile to an environment profile
 */
export function fromDivinaProfile(profile: any): IEnvironmentProfile {
  return {
    id: profile.id,
    userId: profile.userId,
    name: profile.name || 'Unnamed Profile',
    active: profile.active !== false, // Default to true if not specified
    lighting: {
      color: profile.ambience?.lighting?.color || DEFAULT_ENV_PROFILE.lighting.color,
      brightness: profile.ambience?.lighting?.brightness ?? DEFAULT_ENV_PROFILE.lighting.brightness,
      effect: profile.ambience?.lighting?.effect || DEFAULT_ENV_PROFILE.lighting.effect,
      transition: profile.ambience?.lighting?.transition ?? DEFAULT_ENV_PROFILE.lighting.transition,
    },
    mood: {
      primary: profile.ambience?.mood?.primary || DEFAULT_ENV_PROFILE.mood.primary,
      intensity: profile.ambience?.mood?.intensity ?? DEFAULT_ENV_PROFILE.mood.intensity,
      timestamp: profile.updatedAt ? new Date(profile.updatedAt) : new Date(),
    },
    createdAt: profile.createdAt ? new Date(profile.createdAt) : new Date(),
    updatedAt: profile.updatedAt ? new Date(profile.updatedAt) : new Date(),
  };
}
