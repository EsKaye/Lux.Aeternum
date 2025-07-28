// Core exports
export * from './light-manager';

// Adapter exports
export * from './govee/govee-adapter';
export * from './philips-hue/hue-adapter';
export * from './gamedin/gamedin-adapter';

// Types and utilities
export * from './interfaces/device.interface';

// Logger
export { Logger, createLogger } from './utils/logger';

// Import all the necessary components
import { createLightManager } from './light-manager';
import { createGoveeAdapter } from './govee/govee-adapter';
import { createPhilipsHueAdapter } from './philips-hue/hue-adapter';
import { createGameDinAdapter, GameDinEventType } from './gamedin/gamedin-adapter';
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
  
  // Constants
  GameDinEventType,
  
  // Utilities
  createLogger,
};

export default LuxAeternumSDK;
