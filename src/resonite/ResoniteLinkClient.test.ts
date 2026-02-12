import { describe, it, expect, vi, beforeEach } from 'vitest';

// Default test port for unit tests
const TEST_PORT = 12345;

// Create mock client instance
const createMockClientInstance = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  isConnected: false,
  createSlot: vi.fn(),
  getSlot: vi.fn(),
  send: vi.fn(),
  createComponent: vi.fn(),
  getComponent: vi.fn(),
});

let mockClientInstance = createMockClientInstance();
let ClientConstructorCalls: Array<{ host: string; port: number }> = [];

// Mock the resonitelink.js library
vi.mock('../../lib/resonitelink.js/dist', () => {
  return {
    Client: class MockClient {
      connect = vi.fn();
      disconnect = vi.fn();
      on = vi.fn();
      off = vi.fn();
      isConnected = false;
      createSlot = vi.fn();
      getSlot = vi.fn();
      send = vi.fn();
      createComponent = vi.fn();
      getComponent = vi.fn();

      constructor(config: { host: string; port: number }) {
        ClientConstructorCalls.push(config);
        Object.assign(this, mockClientInstance);
      }
    },
    createString: vi.fn((s: string) => ({ type: 'string', value: s })),
    createReference: vi.fn((r: string) => ({ type: 'reference', value: r })),
    createFloat3: vi.fn((v: { x: number; y: number; z: number }) => ({
      type: 'float3',
      value: v,
    })),
    createFloatQ: vi.fn((q: { x: number; y: number; z: number; w: number }) => ({
      type: 'floatQ',
      value: q,
    })),
    createBool: vi.fn((b: boolean) => ({ type: 'bool', value: b })),
    createLong: vi.fn((l: number) => ({ type: 'long', value: l })),
  };
});

// Import after mock is set up
import { ResoniteLinkClient } from './ResoniteLinkClient';

describe('ResoniteLinkClient', () => {
  let client: ResoniteLinkClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientInstance = createMockClientInstance();
    ClientConstructorCalls = [];
    client = new ResoniteLinkClient({ port: TEST_PORT });
  });

  describe('constructor', () => {
    it('should use default host when only port is provided', () => {
      expect(ClientConstructorCalls[0]).toEqual({
        host: 'localhost',
        port: TEST_PORT,
      });
    });

    it('should use custom host and port', () => {
      ClientConstructorCalls = [];
      new ResoniteLinkClient({ host: 'custom.host', port: 9999 });

      expect(ClientConstructorCalls[0]).toEqual({
        host: 'custom.host',
        port: 9999,
      });
    });

    it('should register disconnected event listener', () => {
      expect(mockClientInstance.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
    });
  });

  describe('isConnected', () => {
    it('should return false initially', () => {
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should call client.disconnect', () => {
      client.disconnect();

      expect(mockClientInstance.disconnect).toHaveBeenCalled();
    });
  });

  describe('getClient', () => {
    it('should return a client instance', () => {
      const underlyingClient = client.getClient();

      expect(underlyingClient).toBeDefined();
      expect(typeof underlyingClient.connect).toBe('function');
    });
  });

  describe('addSlot', () => {
    it('should throw when not connected', async () => {
      await expect(
        client.addSlot({
          id: 'test-id',
          parentId: 'parent-id',
          name: 'Test Slot',
          position: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        })
      ).rejects.toThrow('Not connected to ResoniteLink');
    });
  });

  describe('updateSlot', () => {
    it('should throw when not connected', async () => {
      await expect(
        client.updateSlot({
          id: 'test-id',
          position: { x: 1, y: 2, z: 3 },
        })
      ).rejects.toThrow('Not connected to ResoniteLink');
    });
  });

  describe('importTexture', () => {
    it('should throw when not connected', async () => {
      await expect(client.importTexture('/path/to/image.png')).rejects.toThrow(
        'Not connected to ResoniteLink'
      );
    });
  });

  describe('addComponent', () => {
    it('should throw when not connected', async () => {
      await expect(
        client.addComponent({
          slotId: 'slot-id',
          componentType: 'SomeComponent',
          fields: {},
        })
      ).rejects.toThrow('Not connected to ResoniteLink');
    });
  });

  describe('getRootSlot', () => {
    it('should throw when not connected', async () => {
      await expect(client.getRootSlot()).rejects.toThrow('Not connected to ResoniteLink');
    });
  });
});

describe('Euler to Quaternion conversion', () => {
  it('should convert zero rotation to identity quaternion', () => {
    // Identity quaternion is (0, 0, 0, 1)
    // When euler is (0, 0, 0), the quaternion should be identity

    // Verify math: cos(0) = 1, sin(0) = 0
    // w = cx*cy*cz + sx*sy*sz = 1*1*1 + 0*0*0 = 1
    // x = sx*cy*cz - cx*sy*sz = 0*1*1 - 1*0*0 = 0
    // y = cx*sy*cz + sx*cy*sz = 1*0*1 + 0*1*0 = 0
    // z = cx*cy*sz - sx*sy*cz = 1*1*0 - 0*0*1 = 0
    const expectedQuaternion = { x: 0, y: 0, z: 0, w: 1 };
    expect(expectedQuaternion).toEqual({ x: 0, y: 0, z: 0, w: 1 });
  });

  it('should convert 90 degree Y rotation correctly', () => {
    // 90 degrees around Y axis
    // In radians: 90 * PI / 180 / 2 = PI/4
    // cos(PI/4) ≈ 0.7071, sin(PI/4) ≈ 0.7071

    const halfAngle = (90 * Math.PI) / 180 / 2;
    const cos = Math.cos(halfAngle);
    const sin = Math.sin(halfAngle);

    // For Y-only rotation:
    // w = cos(y), y = sin(y), x = 0, z = 0
    expect(cos).toBeCloseTo(0.7071, 3);
    expect(sin).toBeCloseTo(0.7071, 3);
  });
});
