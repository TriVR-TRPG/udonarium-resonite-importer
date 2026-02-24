import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ResoniteLink } from '@eth0fox/tsrl';
import { WebSocket as NodeWebSocket } from 'ws';

const TEST_PORT = 12345;

const createMockLink = () => ({
  socket: { readyState: 1, OPEN: 1, close: vi.fn() },
  call: vi.fn(),
  slotAdd: vi.fn(),
  slotUpdate: vi.fn(),
  slotGet: vi.fn(),
  slotRemove: vi.fn(),
  componentAdd: vi.fn(),
  componentUpdate: vi.fn(),
  componentGet: vi.fn(),
  importTexture2DFile: vi.fn(),
  importTexture2DRawData: vi.fn(),
});

let mockLink = createMockLink();
const connectMock = vi.fn();
let originalGlobalWebSocket: unknown;

import { ResoniteLinkClient } from './ResoniteLinkClient';

describe('ResoniteLinkClient', () => {
  let client: ResoniteLinkClient;

  beforeEach(() => {
    originalGlobalWebSocket = (globalThis as Record<string, unknown>).WebSocket;
    vi.clearAllMocks();
    mockLink = createMockLink();
    connectMock.mockResolvedValue(mockLink);
    ResoniteLinkClient.setRuntimeModuleLoaderForTests(
      async () =>
        (await Promise.resolve({
          ResoniteLink: { connect: connectMock },
        })) as unknown as {
          ResoniteLink: {
            connect: (url: string, webSocketCtor: unknown) => Promise<ResoniteLink>;
          };
        }
    );
    client = new ResoniteLinkClient({ port: TEST_PORT });
  });

  afterEach(() => {
    const globalWithWebSocket = globalThis as Record<string, unknown>;
    if (originalGlobalWebSocket === undefined) {
      delete globalWithWebSocket.WebSocket;
    } else {
      globalWithWebSocket.WebSocket = originalGlobalWebSocket;
    }
    ResoniteLinkClient.setRuntimeModuleLoaderForTests(undefined);
  });

  it('connect/disconnect works', async () => {
    await client.connect();
    expect(client.isConnected()).toBe(true);

    client.disconnect();
    expect(mockLink.socket.close).toHaveBeenCalled();
    expect(client.isConnected()).toBe(false);
  });

  it('addSlot sends addSlot call with field wrappers', async () => {
    await client.connect();
    mockLink.call.mockResolvedValue({ success: true });

    const id = await client.addSlot({
      id: 'slot-id',
      parentId: 'Root',
      name: 'Test',
      position: { x: 0, y: 0, z: 0 },
      tag: 'tagged',
    });

    expect(id).toBe('slot-id');
    expect(mockLink.call).toHaveBeenCalledTimes(1);
    const [payload] = mockLink.call.mock.calls[0] as [Record<string, unknown>];
    expect(payload.$type).toBe('addSlot');
    const data = payload.data as Record<string, unknown>;
    expect(data.id).toBe('slot-id');
    expect(data.parent).toEqual(expect.objectContaining({ targetId: 'Root' }));
    expect(data.tag).toEqual(expect.objectContaining({ value: 'tagged' }));
  });

  it('throws when not connected', async () => {
    await expect(client.importTexture('/tmp/a.png')).rejects.toThrow(
      'Not connected to ResoniteLink'
    );
  });

  it('captureTransformAndRemoveRootChildrenByTag removes only matching', async () => {
    await client.connect();
    mockLink.slotGet
      .mockResolvedValueOnce({ id: 'Root', children: [{ id: 'slot-a' }, { id: 'slot-b' }] })
      .mockResolvedValueOnce({ id: 'slot-a', tag: { value: 'keep' } })
      .mockResolvedValueOnce({
        id: 'slot-b',
        tag: { value: 'delete-me' },
      })
      .mockResolvedValueOnce({
        id: 'slot-b',
        position: { value: { x: 1, y: 2, z: 3 } },
        rotation: { value: { x: 0, y: 0.5, z: 0, w: 0.866 } },
        scale: { value: { x: 4, y: 5, z: 6 } },
      });

    const result = await client.captureTransformAndRemoveRootChildrenByTag('delete-me');

    expect(result.removedCount).toBe(1);
    expect(result.transform).toEqual({
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 0.5, z: 0, w: 0.866 },
      scale: { x: 4, y: 5, z: 6 },
    });
    expect(mockLink.slotRemove).toHaveBeenCalledWith('slot-b');
  });

  it('updateSlot converts Euler rotation to Resonite-compatible quaternion', async () => {
    await client.connect();
    mockLink.slotUpdate.mockResolvedValue({ success: true });

    await client.updateSlot({
      id: 'slot-rot',
      rotation: { x: 0, y: -30, z: 180 },
    });

    expect(mockLink.slotUpdate).toHaveBeenCalledTimes(1);
    const [slotId, payload] = mockLink.slotUpdate.mock.calls[0] as [
      string,
      { rotation?: { value: { x: number; y: number; z: number; w: number } } },
    ];
    expect(slotId).toBe('slot-rot');
    expect(payload.rotation).toBeDefined();
    expect(payload.rotation?.value.x).toBeCloseTo(-0.258819, 5);
    expect(payload.rotation?.value.y).toBeCloseTo(0, 5);
    expect(payload.rotation?.value.z).toBeCloseTo(0.965926, 5);
    expect(payload.rotation?.value.w).toBeCloseTo(0, 5);
  });

  it('updateSlot updates tag field when provided', async () => {
    await client.connect();
    mockLink.slotUpdate.mockResolvedValue({ success: true });

    await client.updateSlot({
      id: 'slot-tag',
      tag: 'import-root',
    });

    expect(mockLink.slotUpdate).toHaveBeenCalledTimes(1);
    const [slotId, payload] = mockLink.slotUpdate.mock.calls[0] as [
      string,
      { tag?: { value: string } },
    ];
    expect(slotId).toBe('slot-tag');
    expect(payload.tag).toEqual(expect.objectContaining({ value: 'import-root' }));
  });

  it('passes ws.WebSocket constructor to tsrl connect', async () => {
    await client.connect();
    expect(connectMock).toHaveBeenCalledTimes(1);
    const [, wsCtor] = connectMock.mock.calls[0] as [string, unknown];
    expect(wsCtor).toBe(NodeWebSocket);
  });

  it('ensures global WebSocket before connecting', async () => {
    const globalWithWebSocket = globalThis as Record<string, unknown>;
    delete globalWithWebSocket.WebSocket;
    await client.connect();
    expect(globalWithWebSocket.WebSocket).toBe(NodeWebSocket);
  });
});
