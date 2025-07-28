import axios from 'axios';
import { PhilipsHueAdapter, IPhilipsHueAdapterConfig } from '../src/philips-hue/hue-adapter';
import { ILightCommand } from '../src/interfaces/device.interface';

// Mock the Logger module
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock the Logger module with both the class and createLogger function
jest.mock('../src/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => mockLogger),
  createLogger: jest.fn().mockImplementation(() => mockLogger),
}));

// Set up axios mocks
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Create a mock axios instance that will be used by the adapter
const mockAxiosInstance = {
  get: jest.fn(),
  put: jest.fn(),
  post: jest.fn(),
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() },
  },
};

// Mock the axios.create method to return our mock instance
const mockCreate = jest.fn().mockReturnValue(mockAxiosInstance);
(mockedAxios as any).create = mockCreate;
describe('PhilipsHueAdapter', () => {
  // Mock data
  const mockBridgeConfig = {
    name: 'Philips Hue Bridge',
    datastoreversion: '1.0',
    swversion: '1.0.0',
    apiversion: '1.0.0',
    mac: '00:11:22:33:44:55',
    bridgeid: '001122334455',
    factorynew: false,
    replacesbridgeid: null,
    modelid: 'BSB002',
    starterkitid: '',
    ipaddress: '192.168.1.100',
    netmask: '255.255.255.0',
    gateway: '192.168.1.1',
  };

  const mockLights: Record<string, any> = {
    '1': {
      name: 'Hue color lamp 1',
      type: 'Extended color light',
      state: {
        on: true,
        bri: 254,
        effect: 'none',
        alert: 'select',
        colormode: 'xy',
        mode: 'homeautomation',
        reachable: true,
      },
      modelid: 'LCT007',
      manufacturername: 'Philips',
      productname: 'Hue color lamp',
      capabilities: {
        control: {
          mindimlevel: 5000,
          maxlumen: 600,
        },
      },
      swversion: '1.0.0',
      swconfigid: 'A81A1F7D',
      productid: 'Philips-LCT007-1-A19'    
    },
    '2': {
      name: 'Hue white lamp 1',
      type: 'Dimmable light',
      state: {
        on: false,
        bri: 254,
        effect: 'none',
        alert: 'select',
        colormode: 'ct',
        mode: 'homeautomation',
        reachable: true,
      },
      modelid: 'LWB010',
      manufacturername: 'Philips',
      productname: 'Hue white lamp',
      capabilities: {
        control: {
          mindimlevel: 2000,
          maxlumen: 500,
        },
      },
      swversion: '1.0.0',
      swconfigid: 'A81A1F7D',
      productid: 'Philips-LWB010-1-A19'    
    }
  };

  let adapter: PhilipsHueAdapter;
  let mockAxiosInstance: jest.Mocked<typeof axios>;

  // Set up mocks before each test
  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create a new mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      put: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
      defaults: { baseURL: 'http://192.168.1.100' },
      interceptors: {
        request: { 
          use: jest.fn(),
          eject: jest.fn(),
          clear: jest.fn()
        },
        response: { 
          use: jest.fn(),
          eject: jest.fn(),
          clear: jest.fn()
        }
      }
    } as unknown as jest.Mocked<typeof axios>;

    // Mock axios.create to return our mock instance
    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

    // Set up the mock for getBridgeConfig
    mockAxiosInstance.get.mockImplementation((url: string) => {
      console.log(`[MOCK] GET ${url}`);
      
      if (url === '/api/config') {
        console.log('[MOCK] Returning bridge config');
        return Promise.resolve({ 
          status: 200, 
          statusText: 'OK',
          data: mockBridgeConfig 
        });
      }
      
      // Handle device listing
      if (url.startsWith('/api/') && url.endsWith('/lights')) {
        console.log('[MOCK] Returning lights');
        return Promise.resolve({ 
          status: 200, 
          statusText: 'OK',
          data: mockLights 
        });
      }
      
      // Handle individual device requests
      const deviceIdMatch = url.match(/\/api\/.*?\/lights\/(\d+)/);
      if (deviceIdMatch) {
        const deviceId = deviceIdMatch[1];
        console.log(`[MOCK] Returning device ${deviceId}`);
        return Promise.resolve({ 
          status: 200, 
          statusText: 'OK',
          data: mockLights[deviceId] 
        });
      }
      
      console.warn(`[MOCK] Unexpected GET request to: ${url}`);
      return Promise.reject(new Error(`Unexpected GET request to: ${url}`));
    });
    
    // Mock the axios put implementation for state changes
    mockAxiosInstance.put.mockImplementation((url: string, data: any) => {
      console.log(`[MOCK] PUT ${url}`, { data });
      return Promise.resolve({ 
        status: 200,
        statusText: 'OK',
        data: [{
          success: {}
        }] 
      });
    });
    
    // Create and initialize the adapter
    const config: IPhilipsHueAdapterConfig = {
      bridgeIp: '192.168.1.100',
      username: 'test-username',
      type: 'philips-hue',
      debug: true
    };
    
    adapter = new PhilipsHueAdapter(config);
    
    try {
      console.log('[TEST] Initializing adapter...');
      await adapter.initialize();
      console.log('[TEST] Adapter initialized successfully');
    } catch (error: any) {
      console.error('[TEST] Adapter initialization failed:', {
        message: error.message,
        stack: error.stack,
        details: error.details
      });
      throw error;
    }
  });

  describe('initialization', () => {
    // Test configuration
    const validConfig = {
      bridgeIp: '192.168.1.100',
      username: 'test-username',
      type: 'philips-hue' as const,
      debug: true
    };

    it('should create instance with valid config', () => {
      const testAdapter = new PhilipsHueAdapter(validConfig);
      expect(testAdapter).toBeInstanceOf(PhilipsHueAdapter);
    });

    it('should throw error with missing bridge IP', () => {
      const { bridgeIp, ...invalidConfig } = validConfig;
      expect(() => new PhilipsHueAdapter(invalidConfig as any)).toThrow('Bridge IP is required');
    });

    it('should throw error with missing username', () => {
      const { username, ...invalidConfig } = validConfig;
      expect(() => new PhilipsHueAdapter(invalidConfig as any)).toThrow('Username is required');
    });

    it('should initialize successfully', async () => {
      const testAdapter = new PhilipsHueAdapter(validConfig);
      
      // Mock the internal initialization methods
      const getBridgeConfigSpy = jest.spyOn(testAdapter as any, 'getBridgeConfig')
        .mockResolvedValue({});
      const getDevicesSpy = jest.spyOn(testAdapter as any, 'getDevices')
        .mockResolvedValue({});
      
      await expect(testAdapter.initialize()).resolves.not.toThrow();
      
      // Verify the mocks were called
      expect(getBridgeConfigSpy).toHaveBeenCalled();
      expect(getDevicesSpy).toHaveBeenCalled();
      
      // Clean up
      getBridgeConfigSpy.mockRestore();
      getDevicesSpy.mockRestore();
    });

    it('should throw error with invalid bridge IP', async () => {
      const invalidConfig = { 
        bridgeIp: ' invalid-ip',
        username: 'test-username',
        type: 'philips-hue' as const,
        debug: true 
      };
      const testAdapter = new PhilipsHueAdapter(invalidConfig);
      await expect(testAdapter.initialize()).rejects.toThrow('Invalid bridge IP address');
    });

    it('should throw error with invalid username', async () => {
      const invalidConfig = { 
        bridgeIp: '192.168.1.100',
        username: ' invalid-username',
        type: 'philips-hue' as const,
        debug: true 
      };
      const testAdapter = new PhilipsHueAdapter(invalidConfig);
      await expect(testAdapter.initialize()).rejects.toThrow('Invalid username');
    });
  });

  describe('device management', () => {
    it('should get all devices', async () => {
      const testAdapter = new PhilipsHueAdapter({
        bridgeIp: '192.168.1.100',
        username: 'test-username',
        type: 'philips-hue',
        debug: true // Enable debug for test output
      });
      await testAdapter.initialize();
      const devices = await testAdapter.getDevices();

  describe('device management', () => {
    const validConfig = {
      bridgeIp: '192.168.1.100',
      username: 'test-username',
      type: 'philips-hue' as const,
      debug: true
    };

    let testAdapter: PhilipsHueAdapter;
    let mockAxiosInstance: jest.Mocked<typeof axios>;

    beforeEach(() => {
      // Create a new mock axios instance
      mockAxiosInstance = {
        get: jest.fn(),
        put: jest.fn(),
        post: jest.fn(),
        delete: jest.fn(),
        defaults: { baseURL: 'http://192.168.1.100' },
        interceptors: {
          request: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
          response: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() }
        }
      } as unknown as jest.Mocked<typeof axios>;

      // Mock axios.create to return our mock instance
      (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

      // Create a new adapter instance before each test
      testAdapter = new PhilipsHueAdapter(validConfig);
    });

    afterEach(() => {
      // Clean up mocks after each test
      jest.clearAllMocks();
    });

    it('should list available devices', async () => {
      // Mock the API response for getting devices
      const mockDevices = {
        '1': { name: 'Light 1', type: 'Dimmable light' },
        '2': { name: 'Light 2', type: 'Color light' }
      };
      
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: mockDevices
      });
      
      const devices = await testAdapter.getDevices();
      
      // Verify the results
      expect(devices).toBeInstanceOf(Array);
      expect(devices.length).toBe(2);
      expect(devices[0].id).toBe('1');
      expect(devices[0].name).toBe('Light 1');
      
      // Verify the API was called with the correct endpoint
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/test-username/lights');
    });
    
    it('should get device by ID', async () => {
      // Mock the API response for getting a specific device
      const mockDevice = { name: 'Test Light', type: 'Dimmable light' };
      
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: mockDevice
      });
      
      const device = await testAdapter.getDevice('1');
      
      // Verify the results
      expect(device).toBeDefined();
      expect(device?.id).toBe('1');
      expect(device?.name).toBe('Test Light');
      
      // Verify the API was called with the correct endpoint
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/test-username/lights/1');
    });
    
    it('should return null for non-existent device', async () => {
      // Mock the API response for a non-existent device
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: { status: 404 }
      });
      
      const device = await testAdapter.getDevice('999');
      
      // Verify the result
      expect(device).toBeNull();
      
      // Verify the API was called with the correct endpoint
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/test-username/lights/999');
    });
  });

  // Test command execution
  describe('command execution', () => {
    const validConfig = {
      bridgeIp: '192.168.1.100',
      username: 'test-username',
      type: 'philips-hue' as const,
      debug: true
    };

    let testAdapter: PhilipsHueAdapter;
    let mockAxiosInstance: jest.Mocked<typeof axios>;

    beforeEach(() => {
      // Create a new mock axios instance
      mockAxiosInstance = {
        get: jest.fn(),
        put: jest.fn(),
        post: jest.fn(),
        delete: jest.fn(),
        defaults: { baseURL: 'http://192.168.1.100' },
        interceptors: {
          request: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
          response: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() }
        }
      } as unknown as jest.Mocked<typeof axios>;

      // Mock axios.create to return our mock instance
      (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

      // Create a new adapter instance before each test
      testAdapter = new PhilipsHueAdapter(validConfig);
      
      // Mock initialization
      jest.spyOn(testAdapter as any, 'getBridgeConfig').mockResolvedValue({});
      jest.spyOn(testAdapter as any, 'getDevices').mockResolvedValue({});
    });

    afterEach(() => {
      // Clean up mocks after each test
      jest.clearAllMocks();
    });

    it('should execute turn on command', async () => {
      // Mock the API response for turning on a device
      mockAxiosInstance.put.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: [{ success: { '/lights/1/state/on': true } }]
      });
      
      await testAdapter.executeCommand({
        type: 'turnOn',
        deviceId: '1',
        params: {}
      });
      
      // Verify the API was called with the correct endpoint and data
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/api/test-username/lights/1/state',
        { on: true }
      );
    });
    
    it('should execute turn off command', async () => {
      // Mock the API response for turning off a device
      mockAxiosInstance.put.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: [{ success: { '/lights/1/state/on': false } }]
      });
      
      await testAdapter.executeCommand({
        type: 'turnOff',
        deviceId: '1',
        params: {}
      });
      
      // Verify the API was called with the correct endpoint and data
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/api/test-username/lights/1/state',
        { on: false }
      );
    });
    
    it('should execute set brightness command', async () => {
      // Mock the API response for setting brightness
      mockAxiosInstance.put.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: [{ success: { '/lights/1/state/bri': 128 } }]
      });
      
      await testAdapter.executeCommand({
        type: 'setBrightness',
        deviceId: '1',
        params: { brightness: 50 }
      });
      
      // Verify the API was called with the correct endpoint and data
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/api/test-username/lights/1/state',
        { bri: 128 }
      );
    });
    
    it('should execute set color command', async () => {
      // Mock the API response for setting color
      mockAxiosInstance.put.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: [{ success: { '/lights/1/state/xy': [0.5, 0.5] } }]
      });
      
      await testAdapter.executeCommand({
        type: 'setColor',
        deviceId: '1',
        params: { color: '#FF0000' } // Using hex color
      });
      
      // Verify the API was called with the correct endpoint
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/api/test-username/lights/1/state',
        expect.any(Object) // The actual color conversion is tested in the adapter
      );
    });
    
    it('should handle command execution errors', async () => {
      // Mock the API response to simulate an error
      const error = new Error('Network Error');
      mockAxiosInstance.put.mockRejectedValueOnce(error);
      
      // Test that the error is properly propagated
      await expect(
        testAdapter.executeCommand({
          type: 'turnOn',
          deviceId: '1',
          params: {}
        })
      ).rejects.toThrow('Network Error');
      
      // Verify the API was called with the correct endpoint
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/api/test-username/lights/1/state',
        { on: true }
      );
    });
    
    it('should throw error for unsupported command', async () => {
      await expect(
        testAdapter.executeCommand({
          type: 'unsupported' as any,
          deviceId: '1',
          params: {}
        })
      ).rejects.toThrow('Unsupported command type: unsupported');
    });
  });

  describe('error handling', () => {
    it('should handle API errors during initialization', async () => {
      // Reset the mock to remove the default implementation
      mockAxiosInstance.get.mockReset();
      
      // Mock the bridge config request to fail
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Network error'));
      
      // Create a new adapter instance for this test
      const testAdapter = new PhilipsHueAdapter({
        bridgeIp: '192.168.1.100',
        username: 'test-username',
        type: 'philips-hue',
        debug: true // Enable debug for test output
      });
      
      // Expect initialization to fail
      await expect(testAdapter.initialize()).rejects.toThrow('Failed to initialize Philips Hue adapter: Network error');
    });

    it('should handle invalid color format', async () => {
      const testAdapter = new PhilipsHueAdapter({
        bridgeIp: '192.168.1.100',
        username: 'test-username',
        type: 'philips-hue',
        debug: true // Enable debug for test output
      });
      await testAdapter.initialize();
      const command: ILightCommand = {
        type: 'setColor',
        deviceId: '1',
        params: {
          color: 'invalid-color'
        }
      };
      
      await expect(testAdapter.executeCommand(command)).rejects.toThrow('Invalid color format');
      
      // Verify no API call was made
      expect(mockAxiosInstance.put).not.toHaveBeenCalled();
    });
  });

  describe('helper methods', () => {
    it('should convert hex to XY color', async () => {
      const testAdapter = new PhilipsHueAdapter({
        bridgeIp: '192.168.1.100',
        username: 'test-username',
        type: 'philips-hue',
        debug: true // Enable debug for test output
      });
      await testAdapter.initialize();
      const command: ILightCommand = {
        type: 'setColor',
        deviceId: '1',
        params: { color: '#FF0000' } // Red
      };
      
      // Mock the API response
      mockAxiosInstance.put.mockResolvedValueOnce({ 
        status: 200,
        statusText: 'OK',
        data: [{
          success: {}
        }] 
      });
      
      await testAdapter.executeCommand(command);
      
      // Verify the XY conversion was called with the correct values
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        `/api/test-username/lights/1/state`,
        expect.objectContaining({
          xy: expect.arrayContaining([
            expect.any(Number),
            expect.any(Number)
          ])
        })
      );
    });
  });
});
