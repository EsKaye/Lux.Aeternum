# Lux Aeternum - Universal Light Integration SDK

![Lux Aeternum Logo](https://via.placeholder.com/150/000000/FFFFFF/?text=Lux+Aeternum)

> **"Let there be light, and there was light."**

Lux Aeternum is a powerful, TypeScript-based SDK that provides a unified interface for controlling smart lighting systems and integrating them with gaming experiences, home automation, and IoT applications. It supports multiple lighting brands and automation platforms through a modular, extensible architecture.

## 🚀 Features

- **Unified API** for multiple lighting systems (Govee, Philips Hue, LIFX, and more)
- **Divina-L3 Ecosystem** integration for spiritual and ambient lighting experiences
- **GameDin Network** integration for real-time event synchronization
- **Automation Platform** integration (Alexa, Google Home, Home Assistant, HomeKit, SmartThings, IFTTT)
- **Event-driven** architecture for reactive lighting effects
- **TypeScript** support with full type definitions
- **Extensible** design for adding new device and platform adapters
- **Cross-platform** - works in Node.js and browser environments
- **CI/CD** ready with GitHub Actions
- **Comprehensive** test coverage
- **Modular** architecture for easy extension

📖 **[Full Documentation](https://github.com/EsKaye/Lux.Aeternum#readme)** |
[API Reference](https://github.com/EsKaye/Lux.Aeternum/docs/API.md) |
[Examples](https://github.com/EsKaye/Lux.Aeternum/examples)

## 🌟 New: Divina-L3 Integration

Seamlessly integrate with the Divina-L3 ecosystem to create immersive, spiritually-inspired lighting experiences:

- **Real-time Sync**: Keep lighting in harmony with user's spiritual state and rituals
- **Emotional Resonance**: Adaptive lighting based on mood and energy levels
- **Ritual Support**: Pre-configured lighting presets for spiritual practices
- **Cross-Device Harmony**: Synchronize lighting across all connected devices

### Getting Started with Divina-L3

```typescript
import { 
  createLightManager, 
  createDivinaL3Adapter, 
  createProfileSyncService 
} from 'lux-aeternum';

// Initialize the light manager
const lightManager = createLightManager();

// Create Divina-L3 adapter
const divinaAdapter = createDivinaL3Adapter(lightManager, {
  baseUrl: 'https://api.divina-l3.com/v1',
  authToken: 'your-auth-token',
  enableRealtimeSync: true
});

// Create profile sync service
const syncService = createProfileSyncService(divinaAdapter);

// Initialize everything
async function init() {
  await lightManager.initialize();
  await divinaAdapter.initialize();
  await syncService.initialize();
  
  console.log('Divina-L3 integration ready!');
}

init().catch(console.error);
```

## 🚀 Getting Started

### Prerequisites

- Node.js 16.x or later
- npm, yarn, or pnpm
- API keys for the services you want to use (Govee, Philips Hue, etc.)
- For automation platforms: Set up developer accounts as needed

### Installation

```bash
# Using npm
npm install lux-aeternum

# Using yarn
yarn add lux-aeternum

# Using pnpm
pnpm add lux-aeternum
```

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/EsKaye/Lux.Aeternum.git
   cd Lux.Aeternum
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Run tests:
   ```bash
   npm test
   ```

5. Start developing! Check out the `examples/` directory for usage patterns.

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

## 🔌 Supported Devices & Platforms

### Lighting Systems

#### Govee
- **Requirements**: Govee API Key
- **Supported Commands**: Power, Color, Brightness, Effects
- **Documentation**: [Govee Adapter](docs/govee-adapter.md)

#### Philips Hue
- **Requirements**: Bridge IP and username
- **Supported Commands**: Power, Color, Brightness, Effects, Scenes
- **Documentation**: [Philips Hue Adapter](docs/philips-hue-adapter.md)

#### LIFX (Coming Soon)
- **Requirements**: LIFX API Key
- **Supported Commands**: Power, Color, Brightness, Effects

### Automation Platforms

#### Google Home
- **Features**: Device discovery, state management, voice control
- **Documentation**: [Google Home Integration](docs/automation/google-home.md)

#### Home Assistant
- **Features**: Full home automation integration, device states, automations
- **Documentation**: [Home Assistant Integration](docs/automation/home-assistant.md)

#### Amazon Alexa
- **Features**: Voice control, routines, device groups
- **Documentation**: [Alexa Integration](docs/automation/alexa.md)

#### Apple HomeKit
- **Features**: Siri control, Home app integration, scenes
- **Documentation**: [HomeKit Integration](docs/automation/homekit.md)

#### SmartThings
- **Features**: Smart home automation, device control, routines
- **Documentation**: [SmartThings Integration](docs/automation/smartthings.md)

#### IFTTT
- **Features**: Webhook integration, applets, cross-service automation
- **Documentation**: [IFTTT Integration](docs/automation/ifttt.md)

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

## 📚 Documentation

### Adapters

- [Philips Hue Adapter](docs/philips-hue-adapter.md) - Control Philips Hue lights
- [Govee Adapter](docs/govee-adapter.md) - Control Govee lights
- [Creating Custom Adapters](docs/creating-adapters.md) - Guide to creating your own adapters

### API Reference

#### LightManager

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

## 🛠️ CI/CD Pipeline

Lux Aeternum uses GitHub Actions for continuous integration and deployment. The pipeline includes:

- **Testing**: Runs on Node.js 16.x and 18.x
- **Code Quality**: Linting and type checking
- **Build Verification**: Ensures the project builds successfully
- **Automated Releases**: Publishes to npm when a new release is created

### Workflow Files

- [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml): Main CI/CD pipeline
- [.github/workflows/release.yml](.github/workflows/release.yml): Release automation

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guidelines](CONTRIBUTING.md) to get started.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Scripts

- `npm test`: Run tests
- `npm run build`: Build the project
- `npm run lint`: Run linter
- `npm run format`: Format code
- `npm run docs`: Generate documentation

## 📄 License

MIT © [Lux Aeternum Team](https://github.com/EsKaye/Lux.Aeternum)

## 📚 Additional Resources

- [API Documentation](https://eskaye.github.io/Lux.Aeternum/)
- [Examples](examples/)
- [Changelog](CHANGELOG.md)
- [Roadmap](ROADMAP.md)
