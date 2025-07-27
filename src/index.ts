// Core exports
export * from './light-manager';

// Adapter exports
export * from './govee/govee-adapter';
export * from './gamedin/gamedin-adapter';

// Types and utilities
export * from './interfaces/device.interface';

export { Logger, createLogger } from './utils/logger';

// Re-export types for convenience
export { GameDinEventType } from './gamedin/gamedin-adapter';

export default {
  // Core
  createLightManager,
  
  // Adapters
  createGoveeAdapter,
  createGameDinAdapter,
  
  // Constants
  GameDinEventType,
  
  // Utilities
  createLogger,
};
