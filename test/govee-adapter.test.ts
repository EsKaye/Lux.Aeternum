import { GoveeAdapter, createGoveeAdapter } from '../src/govee/govee-adapter';
import { LightManager } from '../src/light-manager';
import { IDevice, ILightCommand } from '../src/interfaces/device.interface';
import { Logger } from '../src/utils/logger';

// Mock axios
jest.mock('axios');
const axios = require('axios');

// Mock logger to prevent console output during tests
jest.mock('../src/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
  createLogger: jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('GoveeAdapter', () => {
  let adapter: GoveeAdapter;
  const mockApiKey = 'test-api-key';
  const mockDevice: IDevice = {
    id: 'test-device-1',
    name: 'Test Light',
    type: 'light',
    brand: 'govee',
    model: 'H6001',
    address: 'AA:BB:CC:DD:EE:FF',
    isOn: false,
    isReachable: true,
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create a new adapter instance
    adapter = createGoveeAdapter({
      apiKey: mockApiKey,
      debug: false,
    });
    
    // Mock the axios instance used by the adapter
    axios.create.mockReturnValue({
      get: jest.fn(),
      put: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      // Mock successful device fetch
      axios.create().get.mockResolvedValueOnce({
        data: {
          code: 200,
          message: 'Success',
          data: {
            devices: [
              {
                device: mockDevice.id,
                model: mockDevice.model,
                deviceName: mockDevice.name,
                controllable: true,
                retrievable: true,
                supportCmds: ['turn', 'brightness', 'color', 'colorTem'],
                properties: {
                  online: true,
                  powerState: 'off',
                  brightness: 50,
                },
              },
            ],
          },
        },
      });

      await adapter.initialize();
      
      // Verify initialization
      expect(adapter).toBeInstanceOf(GoveeAdapter);
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://developer-api.govee.com/v1',
        timeout: 5000,
        headers: {
          'Govee-API-Key': mockApiKey,
          'Content-Type': 'application/json',
        },
      });
    });

    it('should handle initialization failure', async () => {
      // Mock failed device fetch
      axios.create().get.mockRejectedValueOnce(new Error('API Error'));
      
      await expect(adapter.initialize()).rejects.toThrow('Failed to initialize Govee adapter');
    });
  });

  describe('getDevices', () => {
    it('should return list of devices', async () => {
      // Mock successful device fetch
      axios.create().get.mockResolvedValueOnce({
        data: {
          code: 200,
          message: 'Success',
          data: {
            devices: [
              {
                device: mockDevice.id,
                model: mockDevice.model,
                deviceName: mockDevice.name,
                controllable: true,
                retrievable: true,
                supportCmds: ['turn', 'brightness', 'color', 'colorTem'],
                properties: {
                  online: true,
                  powerState: 'off',
                  brightness: 50,
                },
              },
            ],
          },
        },
      });

      const devices = await adapter.getDevices();
      
      expect(devices).toHaveLength(1);
      expect(devices[0].id).toBe(mockDevice.id);
      expect(devices[0].name).toBe(mockDevice.name);
      expect(devices[0].isOn).toBe(false);
      expect(devices[0].brightness).toBe(50);
    });
  });

  describe('executeCommand', () => {
    beforeEach(async () => {
      // Initialize with a mock device
      axios.create().get.mockResolvedValueOnce({
        data: {
          code: 200,
          message: 'Success',
          data: {
            devices: [
              {
                device: mockDevice.id,
                model: mockDevice.model,
                deviceName: mockDevice.name,
                controllable: true,
                retrievable: true,
                supportCmds: ['turn', 'brightness', 'color', 'colorTem'],
                properties: {
                  online: true,
                  powerState: 'off',
                  brightness: 50,
                },
              },
            ],
          },
        },
      });
      
      await adapter.initialize();
      
      // Mock successful command response
      axios.create().put.mockResolvedValue({
        data: {
          code: 200,
          message: 'Success',
          data: {},
        },
      });
    });

    it('should execute turn on command', async () => {
      const command: ILightCommand = {
        type: 'turnOn',
        deviceId: mockDevice.id,
        params: {},
      };

      await adapter.executeCommand(command);
      
      // Verify the API call
      expect(axios.create().put).toHaveBeenCalledWith(
        '/devices/control',
        {
          device: mockDevice.address,
          model: mockDevice.model,
          cmd: {
            turn: 'on',
          },
        }
      );
    });

    it('should execute set color command', async () => {
      const command: ILightCommand = {
        type: 'setColor',
        deviceId: mockDevice.id,
        params: { color: '#FF0000' },
      };

      await adapter.executeCommand(command);
      
      // Verify the API call
      expect(axios.create().put).toHaveBeenCalledWith(
        '/devices/control',
        {
          device: mockDevice.address,
          model: mockDevice.model,
          cmd: {
            color: { r: 255, g: 0, b: 0 },
          },
        }
      );
    });

    it('should execute set brightness command', async () => {
      const command: ILightCommand = {
        type: 'setBrightness',
        deviceId: mockDevice.id,
        params: { brightness: 75 },
      };

      await adapter.executeCommand(command);
      
      // Verify the API call
      expect(axios.create().put).toHaveBeenCalledWith(
        '/devices/control',
        {
          device: mockDevice.address,
          model: mockDevice.model,
          cmd: {
            brightness: 75,
          },
        }
      );
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      // Initialize with a mock device
      axios.create().get.mockResolvedValueOnce({
        data: {
          code: 200,
          message: 'Success',
          data: {
            devices: [
              {
                device: mockDevice.id,
                model: mockDevice.model,
                deviceName: mockDevice.name,
                controllable: true,
                retrievable: true,
                supportCmds: ['turn', 'brightness', 'color', 'colorTem'],
                properties: {
                  online: true,
                  powerState: 'off',
                  brightness: 50,
                },
              },
            ],
          },
        },
      });
      
      await adapter.initialize();
      
      // Mock failed command
      axios.create().put.mockResolvedValue({
        data: {
          code: 500,
          message: 'Internal Server Error',
          data: null,
        },
      });

      const command: ILightCommand = {
        type: 'turnOn',
        deviceId: mockDevice.id,
        params: {},
      };

      await expect(adapter.executeCommand(command)).rejects.toThrow(
        'Failed to send command to device: Failed to send command to device: Internal Server Error'
      );
    });
  });
});
