import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { SlotBuilder } from './SlotBuilder';
import { ResoniteLinkClient } from './ResoniteLinkClient';
import { ResoniteObject } from '../converter/ResoniteObject';
import { IMPORT_GROUP_SCALE } from '../config/MappingConfig';

// Mock ResoniteLinkClient
vi.mock('./ResoniteLinkClient', () => {
  return {
    ResoniteLinkClient: vi.fn().mockImplementation(() => ({
      addSlot: vi.fn(),
      updateSlot: vi.fn(),
    })),
  };
});

describe('SlotBuilder', () => {
  let mockClient: {
    addSlot: Mock;
    updateSlot: Mock;
  };
  let slotBuilder: SlotBuilder;

  const createResoniteObject = (overrides: Partial<ResoniteObject> = {}): ResoniteObject => ({
    id: 'test-id',
    name: 'Test Object',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    textures: [],
    components: [],
    children: [],
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      addSlot: vi.fn().mockResolvedValue('created-slot-id'),
      updateSlot: vi.fn().mockResolvedValue(undefined),
    };
    slotBuilder = new SlotBuilder(mockClient as unknown as ResoniteLinkClient);
  });

  describe('constructor', () => {
    it('should use default rootSlotId of "Root"', async () => {
      const obj = createResoniteObject();
      await slotBuilder.buildSlot(obj);

      expect(mockClient.addSlot).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 'Root',
        })
      );
    });

    it('should use custom rootSlotId when provided', async () => {
      const customBuilder = new SlotBuilder(
        mockClient as unknown as ResoniteLinkClient,
        'CustomRoot'
      );
      const obj = createResoniteObject();
      await customBuilder.buildSlot(obj);

      expect(mockClient.addSlot).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 'CustomRoot',
        })
      );
    });
  });

  describe('buildSlot', () => {
    it('should create a slot with correct parameters', async () => {
      const obj = createResoniteObject({
        id: 'char-001',
        name: 'Test Character',
        position: { x: 1, y: 2, z: 3 },
        scale: { x: 0.5, y: 0.5, z: 0.5 },
      });

      const result = await slotBuilder.buildSlot(obj);

      expect(mockClient.addSlot).toHaveBeenCalledWith({
        id: 'char-001',
        parentId: 'Root',
        name: 'Test Character',
        position: { x: 1, y: 2, z: 3 },
        scale: { x: 0.5, y: 0.5, z: 0.5 },
      });
      expect(result.success).toBe(true);
      expect(result.slotId).toBe('created-slot-id');
    });

    it('should use provided parentId instead of rootSlotId', async () => {
      const obj = createResoniteObject();
      await slotBuilder.buildSlot(obj, 'custom-parent');

      expect(mockClient.addSlot).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 'custom-parent',
        })
      );
    });

    it('should not call updateSlot when rotation is zero', async () => {
      const obj = createResoniteObject({
        rotation: { x: 0, y: 0, z: 0 },
      });

      await slotBuilder.buildSlot(obj);

      expect(mockClient.updateSlot).not.toHaveBeenCalled();
    });

    it('should call updateSlot when rotation X is non-zero', async () => {
      const obj = createResoniteObject({
        rotation: { x: 45, y: 0, z: 0 },
      });

      await slotBuilder.buildSlot(obj);

      expect(mockClient.updateSlot).toHaveBeenCalledWith({
        id: 'created-slot-id',
        rotation: { x: 45, y: 0, z: 0 },
      });
    });

    it('should call updateSlot when rotation Y is non-zero', async () => {
      const obj = createResoniteObject({
        rotation: { x: 0, y: 90, z: 0 },
      });

      await slotBuilder.buildSlot(obj);

      expect(mockClient.updateSlot).toHaveBeenCalledWith({
        id: 'created-slot-id',
        rotation: { x: 0, y: 90, z: 0 },
      });
    });

    it('should call updateSlot when rotation Z is non-zero', async () => {
      const obj = createResoniteObject({
        rotation: { x: 0, y: 0, z: 180 },
      });

      await slotBuilder.buildSlot(obj);

      expect(mockClient.updateSlot).toHaveBeenCalledWith({
        id: 'created-slot-id',
        rotation: { x: 0, y: 0, z: 180 },
      });
    });

    it('should build children recursively', async () => {
      const childObj = createResoniteObject({
        id: 'child-001',
        name: 'Child Object',
      });
      const parentObj = createResoniteObject({
        id: 'parent-001',
        name: 'Parent Object',
        children: [childObj],
      });

      await slotBuilder.buildSlot(parentObj);

      // First call for parent
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(1, {
        id: 'parent-001',
        parentId: 'Root',
        name: 'Parent Object',
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      });

      // Second call for child with parent's slot ID
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(2, {
        id: 'child-001',
        parentId: 'created-slot-id',
        name: 'Child Object',
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      });
    });

    it('should build multiple levels of nested children', async () => {
      const grandchildObj = createResoniteObject({
        id: 'grandchild-001',
        name: 'Grandchild Object',
      });
      const childObj = createResoniteObject({
        id: 'child-001',
        name: 'Child Object',
        children: [grandchildObj],
      });
      const parentObj = createResoniteObject({
        id: 'parent-001',
        name: 'Parent Object',
        children: [childObj],
      });

      await slotBuilder.buildSlot(parentObj);

      expect(mockClient.addSlot).toHaveBeenCalledTimes(3);
    });

    it('should return error result when addSlot fails', async () => {
      mockClient.addSlot.mockRejectedValue(new Error('Connection failed'));
      const obj = createResoniteObject({ id: 'fail-id' });

      const result = await slotBuilder.buildSlot(obj);

      expect(result.success).toBe(false);
      expect(result.slotId).toBe('fail-id');
      expect(result.error).toBe('Connection failed');
    });

    it('should handle non-Error exceptions', async () => {
      mockClient.addSlot.mockRejectedValue('String error');
      const obj = createResoniteObject({ id: 'fail-id' });

      const result = await slotBuilder.buildSlot(obj);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('buildSlots', () => {
    it('should build multiple slots', async () => {
      const objects = [
        createResoniteObject({ id: 'obj-1', name: 'Object 1' }),
        createResoniteObject({ id: 'obj-2', name: 'Object 2' }),
        createResoniteObject({ id: 'obj-3', name: 'Object 3' }),
      ];

      const results = await slotBuilder.buildSlots(objects);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(mockClient.addSlot).toHaveBeenCalledTimes(3);
    });

    it('should call progress callback for each object', async () => {
      const objects = [
        createResoniteObject({ id: 'obj-1' }),
        createResoniteObject({ id: 'obj-2' }),
      ];
      const progressCallback = vi.fn();

      await slotBuilder.buildSlots(objects, progressCallback);

      expect(progressCallback).toHaveBeenCalledTimes(2);
      expect(progressCallback).toHaveBeenNthCalledWith(1, 1, 2);
      expect(progressCallback).toHaveBeenNthCalledWith(2, 2, 2);
    });

    it('should continue building even if one slot fails', async () => {
      mockClient.addSlot
        .mockResolvedValueOnce('slot-1')
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('slot-3');

      const objects = [
        createResoniteObject({ id: 'obj-1' }),
        createResoniteObject({ id: 'obj-2' }),
        createResoniteObject({ id: 'obj-3' }),
      ];

      const results = await slotBuilder.buildSlots(objects);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });

    it('should return empty array for empty input', async () => {
      const results = await slotBuilder.buildSlots([]);

      expect(results).toHaveLength(0);
      expect(mockClient.addSlot).not.toHaveBeenCalled();
    });

    it('should work without progress callback', async () => {
      const objects = [createResoniteObject({ id: 'obj-1' })];

      const results = await slotBuilder.buildSlots(objects);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });
  });

  describe('createImportGroup', () => {
    it('should create a group slot with UUID-based ID', async () => {
      await slotBuilder.createImportGroup('My Import');

      expect(mockClient.addSlot).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 'Root',
          name: 'My Import',
          position: { x: 0, y: 0, z: 0 },
          scale: { x: IMPORT_GROUP_SCALE, y: IMPORT_GROUP_SCALE, z: IMPORT_GROUP_SCALE },
        })
      );

      const callArgs = mockClient.addSlot.mock.calls[0][0] as { id: string };
      expect(callArgs.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
    });

    it('should return the group slot ID', async () => {
      mockClient.addSlot.mockResolvedValue('group-slot-id');

      const groupId = await slotBuilder.createImportGroup('Test Group');

      // Note: createImportGroup sets rootSlotId to the created ID, not returned from addSlot
      expect(groupId).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
    });

    it('should update rootSlotId for subsequent builds', async () => {
      await slotBuilder.createImportGroup('Import Group');
      const obj = createResoniteObject();

      // Reset call history after createImportGroup
      const groupCallArgs = mockClient.addSlot.mock.calls[0][0] as { id: string };
      const groupId = groupCallArgs.id;
      mockClient.addSlot.mockClear();

      await slotBuilder.buildSlot(obj);

      expect(mockClient.addSlot).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: groupId,
        })
      );
    });
  });
});
