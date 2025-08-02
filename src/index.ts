// Core exports
export * from './light-manager';

// Adapter exports
export * from './govee/govee-adapter';
export * from './philips-hue/hue-adapter';
export * from './gamedin/gamedin-adapter';
export * from './libs/adapters/divina-l3/divina-l3-adapter';

// Models and types
export * from './interfaces/device.interface';
export * from './libs/models/env-profile.model';

// Services
export * from './services/sync/profile-sync.service';

// Logger
export { Logger, createLogger } from './utils/logger';

// Import all the necessary components
import { createLightManager } from './light-manager';
import { createGoveeAdapter } from './govee/govee-adapter';
import { createPhilipsHueAdapter } from './philips-hue/hue-adapter';
import { createGameDinAdapter, GameDinEventType } from './gamedin/gamedin-adapter';
import { createDivinaL3Adapter } from './libs/adapters/divina-l3/divina-l3-adapter';
import { createProfileSyncService } from './services/sync/profile-sync.service';
import { createLogger } from './utils/logger';

// Re-export types for convenience
export { GameDinEventType };

// Main SDK exports
const LuxAeternumSDK = {
  // Core
  createLightManager,
  
  // Adapters
  createGoveeAdapter,
  createPhilipsHueAdapter,
  createGameDinAdapter,
  createDivinaL3Adapter,
  
  // Services
  createProfileSyncService,
  
  // Constants
  GameDinEventType,
  
  // Utilities
  createLogger,
};

export default LuxAeternumSDK;
