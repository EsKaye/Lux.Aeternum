# Philips Hue Adapter

The Philips Hue adapter allows you to control Philips Hue lights through the Lux Aeternum SDK. This document provides a guide on how to set up and use the Philips Hue adapter.

## Prerequisites

- A Philips Hue Bridge (2nd generation or later)
- The bridge must be connected to your local network
- The bridge IP address (can be found in the Philips Hue app)
- A username (API key) for authenticating with the bridge

## Installation

The Philips Hue adapter is included in the main Lux Aeternum package. No additional installation is required.

```bash
npm install lux-aeternum
```

## Setup

### 1. Create a User (API Key)

Before you can control your Philips Hue lights, you need to create a user (API key) for your application:

```typescript
import { createPhilipsHueAdapter } from 'lux-aeternum';

async function createUser() {
  const adapter = new createPhilipsHueAdapter({
    bridgeIp: 'YOUR_BRIDGE_IP', // Replace with your bridge IP
    type: 'philips-hue',
    debug: true
  });

  try {
    // You'll need to press the link button on your Hue Bridge when running this
    const username = await adapter.createUser('my-app#test');
    console.log('Created user with username:', username);
    // Save this username for future use
  } catch (error) {
    console.error('Failed to create user:', error);
  }
}

createUser();
```

### 2. Initialize the Adapter

Once you have a username, you can initialize the adapter:

```typescript
import { createPhilipsHueAdapter } from 'lux-aeternum';

const hueAdapter = createPhilipsHueAdapter({
  bridgeIp: 'YOUR_BRIDGE_IP', // Replace with your bridge IP
  username: 'YOUR_USERNAME',   // The username from the previous step
  type: 'philips-hue',
  debug: true
});

async function init() {
  try {
    await hueAdapter.initialize();
    console.log('Philips Hue adapter initialized');
    
    // List all available devices
    const devices = await hueAdapter.getDevices();
    console.log('Available devices:', devices);
  } catch (error) {
    console.error('Failed to initialize Philips Hue adapter:', error);
  }
}

init();
```

## Usage with LightManager

The recommended way to use the Philips Hue adapter is through the `LightManager`, which provides a unified interface for all supported lighting systems:

```typescript
import { createLightManager } from 'lux-aeternum';

// Create a LightManager instance
const lightManager = createLightManager({
  debug: true,
  adapters: [
    {
      type: 'philips-hue',
      bridgeIp: 'YOUR_BRIDGE_IP',
      username: 'YOUR_USERNAME',
      name: 'Hue Living Room'
    }
  ]
});

async function controlLights() {
  try {
    // Initialize all adapters
    await lightManager.initialize();
    
    // Get all devices across all adapters
    const allDevices = await lightManager.getDevices();
    console.log('All devices:', allDevices);
    
    // Find a specific device
    const hueLights = allDevices.filter(device => device.brand === 'philips');
    
    if (hueLights.length > 0) {
      const light = hueLights[0];
      
      // Turn on the light
      await lightManager.executeCommand({
        type: 'turnOn',
        deviceId: light.id,
        params: {}
      });
      
      // Set brightness to 50%
      await lightManager.executeCommand({
        type: 'setBrightness',
        deviceId: light.id,
        params: { brightness: 50 }
      });
      
      // Set color to red
      await lightManager.executeCommand({
        type: 'setColor',
        deviceId: light.id,
        params: { color: '#FF0000' }
      });
    }
  } catch (error) {
    console.error('Error controlling lights:', error);
  }
}

controlLights();
```

## API Reference

### `createPhilipsHueAdapter(config: IPhilipsHueAdapterConfig): PhilipsHueAdapter`

Creates a new Philips Hue adapter instance.

#### Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `bridgeIp` | `string` | Yes | - | The IP address of your Philips Hue Bridge |
| `username` | `string` | No | - | The username (API key) for authenticating with the bridge |
| `clientKey` | `string` | No | - | Client key for the streaming API (for push updates) |
| `timeout` | `number` | No | `5000` | Timeout for API requests in milliseconds |
| `useHttps` | `boolean` | No | `false` | Whether to use HTTPS for API requests |
| `port` | `number` | No | - | Custom port number (defaults to 80 for HTTP, 443 for HTTPS) |
| `debug` | `boolean` | No | `false` | Enable debug logging |
| `logger` | `Logger` | No | - | Custom logger instance |

### Methods

#### `initialize(): Promise<void>`

Initializes the adapter and connects to the Philips Hue Bridge.

#### `getDevices(): Promise<IDevice[]>`

Retrieves all available Philips Hue lights.

#### `getDevice(deviceId: string): Promise<IDevice | null>`

Retrieves a specific device by its ID.

#### `executeCommand(command: ILightCommand): Promise<void>`

Executes a light command. Supported commands:

- `turnOn`: Turn on the light
- `turnOff`: Turn off the light
- `setBrightness`: Set the brightness (0-100%)
- `setColor`: Set the color using a hex color code (e.g., '#FF0000' for red)

#### `createUser(deviceType?: string): Promise<string>`

Creates a new user/API key for the Philips Hue Bridge. You'll need to press the link button on the bridge when calling this method.

## Troubleshooting

### Authentication Issues

- **Error: "link button not pressed"**: You need to press the link button on your Philips Hue Bridge before calling `createUser()`.
- **Error: "unauthorized user"**: The provided username is invalid. Make sure to use the correct username or create a new one.

### Connection Issues

- **Error: "Network Error"**: The bridge is not reachable. Check if:
  - The bridge is powered on
  - The IP address is correct
  - Your computer is on the same network as the bridge
  - No firewall is blocking the connection

### Device Discovery

- If devices are not being discovered, try:
  - Restarting the bridge
  - Making sure the lights are powered on and connected to the bridge
  - Checking the Philips Hue app to verify the lights are properly paired

## Example: Reacting to Game Events

Here's an example of how to use the Philips Hue adapter to react to game events:

```typescript
import { createLightManager } from 'lux-aeternum';

const lightManager = createLightManager({
  adapters: [
    {
      type: 'philips-hue',
      bridgeIp: 'YOUR_BRIDGE_IP',
      username: 'YOUR_USERNAME',
      name: 'Hue Gaming'
    }
  ]
});

// Initialize and set up event listeners
async function setup() {
  await lightManager.initialize();
  
  // Get all devices
  const devices = await lightManager.getDevices();
  const hueLights = devices.filter(device => device.brand === 'philips');
  
  if (hueLights.length === 0) {
    console.warn('No Philips Hue lights found');
    return;
  }
  
  // Example: React to game events
  function onGameEvent(event) {
    const lightId = hueLights[0].id; // Use the first light
    
    switch (event.type) {
      case 'game:start':
        lightManager.executeCommand({
          type: 'setColor',
          deviceId: lightId,
          params: { color: '#00FF00' } // Green for game start
        });
        break;
        
      case 'game:pause':
        lightManager.executeCommand({
          type: 'setBrightness',
          deviceId: lightId,
          params: { brightness: 30 } // Dim when paused
        });
        break;
        
      case 'game:gameOver':
        lightManager.executeCommand({
          type: 'setColor',
          deviceId: lightId,
          params: { color: '#FF0000' } // Red for game over
        });
        break;
    }
  }
  
  // Example: Simulate game events
  setTimeout(() => onGameEvent({ type: 'game:start' }), 1000);
  setTimeout(() => onGameEvent({ type: 'game:pause' }), 5000);
  setTimeout(() => onGameEvent({ type: 'game:gameOver' }), 10000);
}

setup().catch(console.error);
```

## License

This adapter is part of the Lux Aeternum SDK and is licensed under the MIT License.
