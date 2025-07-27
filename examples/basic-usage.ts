/**
 * Basic usage example for Lux Aeternum SDK
 * 
 * This example demonstrates how to:
 * 1. Initialize the LightManager
 * 2. Connect to Govee devices
 * 3. Control lights directly
 * 4. Set up GameDin event handling
 */

import { 
  createLightManager, 
  createGoveeAdapter, 
  createGameDinAdapter, 
  GameDinEventType,
  Logger
} from '../src';

// Create a logger instance
const logger = new Logger('Example');

async function main() {
  logger.info('Starting Lux Aeternum example...');
  
  try {
    // 1. Create and configure the LightManager
    const lightManager = createLightManager({
      debug: true, // Enable debug logging
    });

    // 2. Add Govee adapter with your API key
    // Replace 'your-govee-api-key' with your actual Govee API key
    const GOVEE_API_KEY = process.env.GOVEE_API_KEY || '3b116053-1ca2-40dd-8941-01981bfc19b0';
    lightManager.addGoveeAdapter(GOVEE_API_KEY);

    // 3. Initialize the light manager
    logger.info('Initializing light manager...');
    await lightManager.initialize();

    // 4. Get all available devices
    logger.info('Discovering devices...');
    const devices = await lightManager.getDevices();
    logger.info(`Found ${devices.length} devices`);

    if (devices.length === 0) {
      logger.warn('No devices found. Please ensure your Govee devices are connected and the API key is correct.');
      return;
    }

    // 5. Display device information
    devices.forEach((device, index) => {
      logger.info(`Device ${index + 1}:`, {
        id: device.id,
        name: device.name,
        type: device.type,
        brand: device.brand,
        isOn: device.isOn,
        brightness: device.brightness,
        color: device.color,
      });
    });

    // 6. Control the first device
    const firstDevice = devices[0];
    logger.info(`Controlling device: ${firstDevice.name}`);
    
    // Turn on the device
    logger.info('Turning on the device...');
    await lightManager.turnOn(firstDevice.id);
    
    // Set brightness to 50%
    logger.info('Setting brightness to 50%...');
    await lightManager.setBrightness(firstDevice.id, 50);
    
    // Cycle through some colors
    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
    
    for (const color of colors) {
      logger.info(`Setting color to ${color}...`);
      await lightManager.setColor(firstDevice.id, color);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    }

    // 7. Set up GameDin integration
    logger.info('Setting up GameDin integration...');
    const gameDinAdapter = createGameDinAdapter(lightManager, {
      // Custom effects can be added here
      defaultEffects: [
        // Victory effect (green pulse)
        {
          eventType: GameDinEventType.MATCH_VICTORY,
          command: {
            type: 'setColor',
            params: { color: '#00FF00' },
          },
          duration: 3000,
          priority: 10,
        },
        // Defeat effect (red flash)
        {
          eventType: GameDinEventType.MATCH_DEFEAT,
          command: {
            type: 'setColor',
            params: { color: '#FF0000' },
          },
          duration: 3000,
          priority: 10,
        },
      ],
    });

    await gameDinAdapter.initialize();
    
    // 8. Simulate some game events
    logger.info('Simulating game events...');
    
    // Simulate match start
    logger.info('Event: Match started');
    await gameDinAdapter.handleEvent({
      type: GameDinEventType.MATCH_START,
      playerId: 'player-123',
      timestamp: Date.now(),
      data: {
        map: 'de_dust2',
        mode: 'competitive',
      },
    });

    // Simulate victory after 2 seconds
    setTimeout(async () => {
      logger.info('Event: Victory!');
      await gameDinAdapter.handleEvent({
        type: GameDinEventType.MATCH_VICTORY,
        playerId: 'player-123',
        timestamp: Date.now(),
        data: {
          score: '16-14',
          mvp: 'player-123',
        },
      });
      
      // Turn off the light after another 5 seconds
      setTimeout(async () => {
        logger.info('Turning off the device...');
        await lightManager.turnOff(firstDevice.id);
        logger.info('Example completed successfully!');
      }, 5000);
      
    }, 2000);
    
  } catch (error) {
    logger.error('An error occurred:', error);
    process.exit(1);
  }
}

// Run the example
main().catch(error => {
  logger.error('Unhandled error in example:', error);
  process.exit(1);
});
