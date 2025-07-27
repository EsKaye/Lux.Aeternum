# Lux Aeternum - Universal Light Integration SDK

![Lux Aeternum Logo](https://via.placeholder.com/150/000000/FFFFFF/?text=Lux+Aeternum)

> **"Let there be light, and there was light."**

Lux Aeternum is a powerful SDK that enables seamless integration between gaming experiences and smart lighting systems. Built with TypeScript, it provides a unified interface to control various RGB lighting systems (Govee, Philips Hue, etc.) and sync them with game events through the GameDin Network.

## 🌟 Features

- **Unified API** for multiple lighting systems (Govee, Philips Hue, and more)
- **GameDin Network** integration for real-time event synchronization
- **Event-driven** architecture for reactive lighting effects
- **TypeScript** support with full type definitions
- **Extensible** design for adding new device adapters
- **Cross-platform** - works in Node.js and browser environments

## 🚀 Getting Started

### Installation

```bash
# Using npm
npm install lux-aeternum

# Using yarn
yarn add lux-aeternum

# Using pnpm
pnpm add lux-aeternum
```

### Basic Usage

```typescript
import { createLightManager, createGoveeAdapter } from 'lux-aeternum';
import { createGameDinAdapter, EventType } from 'lux-aeternum/gamedin';

// Create a light manager instance
const lightManager = createLightManager({
  debug: true, // Enable debug logging
});

// Add Govee adapter
const goveeAdapter = lightManager.addGoveeAdapter({
  apiKey: 'your-govee-api-key',
});

// Initialize the light manager
await lightManager.initialize();

// Get all devices
const devices = await lightManager.getDevices();
console.log('Available devices:', devices);

// Control a light
await lightManager.turnOn(devices[0].id);
await lightManager.setColor(devices[0].id, '#FF0000'); // Red
await lightManager.setBrightness(devices[0].id, 75); // 75% brightness

// Set up GameDin integration
const gameDinAdapter = createGameDinAdapter(lightManager, {
  // Optional: Add custom effects
  defaultEffects: [
    {
      eventType: EventType.MATCH_VICTORY,
      command: {
        type: 'setColor',
        params: { color: '#00FF00' }, // Green for victory
      },
      duration: 5000, // 5 seconds
      priority: 10,
    },
  ],
});

// Initialize GameDin adapter
await gameDinAdapter.initialize();

// Simulate a game event
await gameDinAdapter.handleEvent({
  type: EventType.MATCH_VICTORY,
  playerId: 'player-123',
  timestamp: Date.now(),
  data: {
    // Additional event data
  },
});
```

## 🔌 Supported Devices

### Govee
- Requires: Govee API Key
- Supported Commands: Power, Color, Brightness

### Philips Hue (Coming Soon)
- Requires: Bridge IP and username
- Supported Commands: Power, Color, Brightness, Effects

### LIFX (Coming Soon)
- Requires: LIFX API Key
- Supported Commands: Power, Color, Brightness, Effects

## 🎮 GameDin Network Integration

Lux Aeternum provides seamless integration with the GameDin Network, allowing you to sync lighting effects with in-game events. The following event types are supported out of the box:

- Player events (join, leave, level up)
- Match events (start, end, victory, defeat)
- Chat messages
- Custom events

### Adding Custom Effects

You can easily add custom lighting effects for any GameDin event:

```typescript
gameDinAdapter.addEffect({
  eventType: 'player:customAchievement',
  command: {
    type: 'setColor',
    params: { 
      color: '#FFA500', // Orange
      effect: 'pulse',  // Some adapters support effects
    },
  },
  duration: 3000, // 3 seconds
  priority: 5,
  condition: (event) => {
    // Only trigger for specific achievements
    return event.data?.achievementId === 'epic-win';
  },
});
```

## 📚 API Reference

### LightManager

Core class for managing light adapters and devices.

#### Methods
- `addAdapter(adapter)`: Register a new light adapter
- `addGoveeAdapter(config)`: Helper to add a Govee adapter
- `getDevices()`: Get all available devices
- `getDevice(deviceId)`: Get a specific device by ID
- `executeCommand(command)`: Execute a light command
- `turnOn(deviceId)`: Turn on a device
- `turnOff(deviceId)`: Turn off a device
- `setColor(deviceId, hexColor)`: Set device color
- `setBrightness(deviceId, percentage)`: Set device brightness

### GameDinAdapter

Handles synchronization between GameDin events and lighting effects.

#### Methods
- `addEffect(effect)`: Register a new light effect
- `removeEffect(eventType, index)`: Remove a light effect
- `handleEvent(event)`: Process a GameDin event
- `dispose()`: Clean up resources

## 🤝 Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md) to get started.

## 📄 License

MIT © [Lux Aeternum Team](https://github.com/MKWorldWide/Lux.Aeternum)
