import { AutomationFactory } from '../src/automation';
import { IAutomationConfig } from '../src/interfaces/automation.interface';
import { ILightCommand } from '../src/interfaces/device.interface';
import { Logger } from '../src/utils/logger';

// Configure the logger
const logger = new Logger('AutomationExample');

/**
 * Example of using the automation platform with Alexa integration
 */
async function runAlexaExample() {
  try {
    logger.info('Starting Alexa automation example');

    // Configuration for Alexa integration
    const alexaConfig: IAutomationConfig = {
      type: 'alexa',
      auth: {
        clientId: process.env.ALEXA_CLIENT_ID || 'your-client-id',
        clientSecret: process.env.ALEXA_CLIENT_SECRET || 'your-client-secret',
        refreshToken: process.env.ALEXA_REFRESH_TOKEN || 'your-refresh-token',
      },
      enabled: true,
    };

    // Create the Alexa automation platform instance
    logger.info('Initializing Alexa automation platform...');
    const alexa = await AutomationFactory.createPlatform(alexaConfig);
    
    // Get all devices
    logger.info('Fetching devices...');
    const devices = await alexa.getDevices();
    logger.info(`Found ${devices.length} devices`);
    
    // Print device information
    devices.forEach((device, index) => {
      logger.info(`\nDevice #${index + 1}:`);
      logger.info(`  Name: ${device.name}`);
      logger.info(`  ID: ${device.id}`);
      logger.info(`  Type: ${device.type}`);
      logger.info(`  Brand: ${device.brand}`);
      logger.info(`  Model: ${device.model}`);
      logger.info(`  Is On: ${device.isOn}`);
      if (device.brightness !== undefined) {
        logger.info(`  Brightness: ${device.brightness}%`);
      }
      if (device.color) {
        logger.info(`  Color: ${device.color}`);
      }
    });

    if (devices.length > 0) {
      const firstDevice = devices[0];
      
      // Turn on the first device
      logger.info(`\nTurning on ${firstDevice.name}...`);
      const turnOnCommand: ILightCommand = {
        type: 'turnOn',
        deviceId: firstDevice.id,
        params: {}
      };
      await alexa.executeCommand(turnOnCommand);
      logger.info('Device turned on');
      
      // Set brightness to 50%
      if (firstDevice.capabilities?.brightness) {
        logger.info('\nSetting brightness to 50%...');
        const brightnessCommand: ILightCommand = {
          type: 'setBrightness',
          deviceId: firstDevice.id,
          params: { brightness: 50 }
        };
        await alexa.executeCommand(brightnessCommand);
        logger.info('Brightness set to 50%');
      }
      
      // Set color to blue (if supported)
      if (firstDevice.capabilities?.color) {
        logger.info('\nSetting color to blue...');
        const colorCommand: ILightCommand = {
          type: 'setColor',
          deviceId: firstDevice.id,
          params: { color: '#0000FF' } // Blue
        };
        await alexa.executeCommand(colorCommand);
        logger.info('Color set to blue');
      }
      
      // Listen for device updates
      alexa.onDeviceUpdate((device) => {
        logger.info(`\nDevice ${device.name} updated:`);
        logger.info(`  Is On: ${device.isOn}`);
        if (device.brightness !== undefined) {
          logger.info(`  Brightness: ${device.brightness}%`);
        }
        if (device.color) {
          logger.info(`  Color: ${device.color}`);
        }
      });
      
      // Keep the example running for a while to see updates
      logger.info('\nListening for device updates for 30 seconds...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // Turn off the device
      logger.info('\nTurning off the device...');
      const turnOffCommand: ILightCommand = {
        type: 'turnOff',
        deviceId: firstDevice.id,
        params: {}
      };
      await alexa.executeCommand(turnOffCommand);
      logger.info('Device turned off');
    }
    
    // Disconnect from the platform
    await alexa.disconnect();
    logger.info('Disconnected from Alexa platform');
    
  } catch (error) {
    logger.error('Error in automation example:', error);
    process.exit(1);
  }
}

// Run the example
runAlexaExample().then(() => {
  logger.info('Example completed');
  process.exit(0);
}).catch((error) => {
  logger.error('Example failed:', error);
  process.exit(1);
});
