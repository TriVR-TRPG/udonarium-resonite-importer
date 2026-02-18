import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { SlotBuilder } from './SlotBuilder';
import { ResoniteLinkClient } from './ResoniteLinkClient';
import { ResoniteObject } from '../domain/ResoniteObject';
import {
  IMPORT_GROUP_SCALE,
  IMPORT_GROUP_Y_OFFSET,
  IMPORT_ROOT_TAG,
} from '../config/MappingConfig';

// Mock ResoniteLinkClient
vi.mock('./ResoniteLinkClient', () => {
  return {
    ResoniteLinkClient: vi.fn().mockImplementation(() => ({
      addSlot: vi.fn(),
      updateSlot: vi.fn(),
      addComponent: vi.fn(),
    })),
  };
});

describe('SlotBuilder', () => {
  let mockClient: {
    addSlot: Mock;
    updateSlot: Mock;
    addComponent: Mock;
  };
  let slotBuilder: SlotBuilder;

  const createResoniteObject = (overrides: Partial<ResoniteObject> = {}): ResoniteObject => ({
    id: 'test-id',
    name: 'Test Object',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    components: [],
    children: [],
    ...overrides,
    isActive: overrides.isActive ?? true,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      addSlot: vi.fn().mockResolvedValue('created-slot-id'),
      updateSlot: vi.fn().mockResolvedValue(undefined),
      addComponent: vi.fn().mockResolvedValue('created-component-id'),
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
      });

      const result = await slotBuilder.buildSlot(obj);

      expect(mockClient.addSlot).toHaveBeenCalledWith({
        id: 'char-001',
        parentId: 'Root',
        name: 'Test Character',
        position: { x: 1, y: 2, z: 3 },
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

    it('should pass isActive when explicitly specified', async () => {
      const obj = createResoniteObject({
        isActive: false,
      });

      await slotBuilder.buildSlot(obj);

      expect(mockClient.addSlot).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
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
      });

      // Second call for child with parent's slot ID
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(2, {
        id: 'child-001',
        parentId: 'created-slot-id',
        name: 'Child Object',
        position: { x: 0, y: 0, z: 0 },
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
      expect(mockClient.addSlot).toHaveBeenCalledTimes(7);
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          parentId: 'Root',
          name: 'Tables',
        })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          parentId: 'Root',
          name: 'Objects',
        })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          parentId: 'Root',
          name: 'Inventory',
        })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          name: 'table',
          isActive: true,
        })
      );
      const objectsCallArgs = mockClient.addSlot.mock.calls[1][0] as { id: string };
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        5,
        expect.objectContaining({
          parentId: objectsCallArgs.id,
          id: 'obj-1',
        })
      );
    });

    it('should place tables under Tables and non-table objects under Objects', async () => {
      const table = createResoniteObject({
        id: 'table-1',
        name: 'Table 1',
        children: [
          createResoniteObject({
            id: 'table-1-surface',
            name: 'Table 1-surface',
          }),
        ],
      });
      const character = createResoniteObject({
        id: 'char-1',
        name: 'Character 1',
      });

      await slotBuilder.buildSlots([table, character]);

      const tablesSlotCall = mockClient.addSlot.mock.calls[0][0] as { id: string };
      const objectsSlotCall = mockClient.addSlot.mock.calls[1][0] as { id: string };
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        5,
        expect.objectContaining({
          id: 'table-1',
          parentId: tablesSlotCall.id,
        })
      );
      expect(
        mockClient.addSlot.mock.calls.some((call) => {
          const args = call[0] as { id?: string; parentId?: string };
          return args.id === 'char-1' && args.parentId === objectsSlotCall.id;
        })
      ).toBe(true);
    });

    it('should place characters under Inventory grouped by location name', async () => {
      const graveyardCharacter = createResoniteObject({
        id: 'char-graveyard',
        name: 'Character Graveyard',
        sourceType: 'character',
        locationName: 'graveyard',
      });
      const commonCharacter = createResoniteObject({
        id: 'char-common',
        name: 'Character Common',
        sourceType: 'character',
      });
      const anotherGraveyardCharacter = createResoniteObject({
        id: 'char-graveyard-2',
        name: 'Character Graveyard 2',
        sourceType: 'character',
        locationName: 'graveyard',
      });

      await slotBuilder.buildSlots([
        graveyardCharacter,
        commonCharacter,
        anotherGraveyardCharacter,
      ]);

      const inventorySlotCall = mockClient.addSlot.mock.calls[2][0] as { id: string };
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          parentId: inventorySlotCall.id,
          name: 'table',
          isActive: true,
        })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        5,
        expect.objectContaining({
          parentId: inventorySlotCall.id,
          name: 'graveyard',
          isActive: false,
        })
      );
      const graveyardSlotCall = mockClient.addSlot.mock.calls[4][0] as { id: string };
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        6,
        expect.objectContaining({ id: 'char-graveyard', parentId: graveyardSlotCall.id })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        7,
        expect.objectContaining({
          parentId: inventorySlotCall.id,
          name: 'Unknown',
          isActive: false,
        })
      );
      const unknownSlotCall = mockClient.addSlot.mock.calls[6][0] as { id: string };
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        8,
        expect.objectContaining({ id: 'char-common', parentId: unknownSlotCall.id })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        9,
        expect.objectContaining({ id: 'char-graveyard-2', parentId: graveyardSlotCall.id })
      );
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
      let callCount = 0;
      mockClient.addSlot.mockImplementation(() => {
        callCount += 1;
        if (callCount === 6) {
          return Promise.reject(new Error('Failed'));
        }
        return Promise.resolve('created-slot-id');
      });

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

    it('should continue building when inventory location slot creation fails', async () => {
      let callCount = 0;
      mockClient.addSlot.mockImplementation(() => {
        callCount += 1;
        if (callCount === 5) {
          return Promise.reject(new Error('Failed to create inventory location slot'));
        }
        return Promise.resolve('created-slot-id');
      });

      const objects = [
        createResoniteObject({
          id: 'char-1',
          sourceType: 'character',
        }),
        createResoniteObject({
          id: 'obj-2',
          sourceType: 'text-note',
        }),
      ];

      const results = await slotBuilder.buildSlots(objects);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Failed to create inventory location slot');
      expect(results[1].success).toBe(true);
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
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ name: 'Tables', parentId: 'Root' })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ name: 'Objects', parentId: 'Root' })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ name: 'Inventory', parentId: 'Root' })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({ name: 'table', isActive: true })
      );
    });
  });

  describe('createTextureAssets', () => {
    it('should create shared texture slots under Assets/Textures', async () => {
      const textureMap = new Map<string, string>([['card-front.png', 'resdb:///card-front']]);

      const result = await slotBuilder.createTextureAssets(textureMap);

      expect(mockClient.addSlot).toHaveBeenCalledTimes(3);
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ name: 'Assets', parentId: 'Root' })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ name: 'Textures' })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ name: 'card-front.png' })
      );

      const firstComponentCall = mockClient.addComponent.mock.calls[0][0] as {
        componentType: string;
        fields: Record<string, unknown>;
      };
      expect(firstComponentCall.componentType).toBe('[FrooxEngine]FrooxEngine.StaticTexture2D');
      expect(firstComponentCall.fields).toMatchObject({
        URL: { $type: 'Uri', value: 'resdb:///card-front' },
      });

      const secondComponentCall = mockClient.addComponent.mock.calls[1][0] as {
        componentType: string;
        fields: Record<string, unknown>;
      };
      expect(secondComponentCall.componentType).toBe(
        '[FrooxEngine]FrooxEngine.MainTexturePropertyBlock'
      );
      const textureField = secondComponentCall.fields.Texture as
        | { $type?: string; targetId?: string }
        | undefined;
      expect(textureField?.$type).toBe('reference');
      expect(textureField?.targetId).toMatch(/-static-texture$/);

      expect(result.get('card-front.png')).toMatch(/-static-texture$/);
    });

    it('should create shared texture assets for external URLs', async () => {
      const textureMap = new Map<string, string>([
        ['external-image', 'https://example.com/image.png'],
      ]);

      const result = await slotBuilder.createTextureAssets(textureMap);

      expect(mockClient.addSlot).toHaveBeenCalledTimes(3);
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ name: 'Assets', parentId: 'Root' })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ name: 'Textures' })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ name: 'external-image' })
      );

      const firstComponentCall = mockClient.addComponent.mock.calls[0][0] as {
        componentType: string;
        fields: Record<string, unknown>;
      };
      expect(firstComponentCall.componentType).toBe('[FrooxEngine]FrooxEngine.StaticTexture2D');
      expect(firstComponentCall.fields).toMatchObject({
        URL: { $type: 'Uri', value: 'https://example.com/image.png' },
      });

      expect(result.get('external-image')).toMatch(/-static-texture$/);
    });
    it('should set point filter mode for gif identifiers', async () => {
      const textureMap = new Map<string, string>([['anim.GIF', 'resdb:///anim']]);

      await slotBuilder.createTextureAssets(textureMap);

      const addComponentCall = mockClient.addComponent.mock.calls[0][0] as {
        fields: Record<string, unknown>;
      };
      expect(addComponentCall.fields).toHaveProperty('FilterMode');
    });

    it('should set point filter mode for gif external URLs', async () => {
      const textureMap = new Map<string, string>([
        ['external-image', 'https://example.com/anim.gif'],
      ]);

      await slotBuilder.createTextureAssets(textureMap);

      const addComponentCall = mockClient.addComponent.mock.calls[0][0] as {
        fields: Record<string, unknown>;
      };
      expect(addComponentCall.fields).toHaveProperty('FilterMode');
    });
  });

  describe('createMeshAssets', () => {
    it('should create shared mesh slots under Assets/Meshes', async () => {
      const result = await slotBuilder.createMeshAssets([
        {
          key: 'box:1,1,1',
          name: 'BoxMesh_1x1x1',
          componentType: '[FrooxEngine]FrooxEngine.BoxMesh',
          sizeFieldType: 'float3',
          sizeValue: { x: 1, y: 1, z: 1 },
        },
      ]);

      expect(mockClient.addSlot).toHaveBeenCalledTimes(3);
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ name: 'Assets', parentId: 'Root' })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ name: 'Meshes' })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ name: 'BoxMesh_1x1x1' })
      );

      const firstComponentCall = mockClient.addComponent.mock.calls[0][0] as {
        componentType: string;
        fields: Record<string, unknown>;
      };
      expect(firstComponentCall.componentType).toBe('[FrooxEngine]FrooxEngine.BoxMesh');
      expect(firstComponentCall.fields).toMatchObject({
        Size: { $type: 'float3', value: { x: 1, y: 1, z: 1 } },
      });

      expect(result.get('box:1,1,1')).toMatch(/-mesh$/);
    });

    it('should reuse existing Assets slot when texture assets already exist', async () => {
      await slotBuilder.createTextureAssets(new Map<string, string>([['a.png', 'resdb:///a']]));
      mockClient.addSlot.mockClear();

      await slotBuilder.createMeshAssets([
        {
          key: 'quad:2,3',
          name: 'QuadMesh_2x3',
          componentType: '[FrooxEngine]FrooxEngine.QuadMesh',
          sizeFieldType: 'float2',
          sizeValue: { x: 2, y: 3 },
        },
      ]);

      expect(mockClient.addSlot).toHaveBeenCalledTimes(2);
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ name: 'Meshes' })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ name: 'QuadMesh_2x3' })
      );
    });
  });

  describe('createMaterialAssets', () => {
    it('should create shared material slots under Assets/Materials', async () => {
      const result = await slotBuilder.createMaterialAssets([
        {
          key: 'xiexe-toon:#FFFFFFFF:Cutout',
          name: 'XiexeToon_Cutout_FFFFFFFF',
          componentType: '[FrooxEngine]FrooxEngine.XiexeToonMaterial',
          fields: {
            BlendMode: { $type: 'enum', value: 'Cutout', enumType: 'BlendMode' },
          },
        },
      ]);

      expect(mockClient.addSlot).toHaveBeenCalledTimes(3);
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ name: 'Assets', parentId: 'Root' })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ name: 'Materials' })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ name: 'XiexeToon_Cutout_FFFFFFFF' })
      );

      const firstComponentCall = mockClient.addComponent.mock.calls[0][0] as {
        componentType: string;
        fields: Record<string, unknown>;
      };
      expect(firstComponentCall.componentType).toBe('[FrooxEngine]FrooxEngine.XiexeToonMaterial');
      expect(firstComponentCall.fields).toMatchObject({
        BlendMode: { $type: 'enum', value: 'Cutout', enumType: 'BlendMode' },
      });

      expect(result.get('xiexe-toon:#FFFFFFFF:Cutout')).toMatch(/-material$/);
    });
  });

  describe('createImportGroup', () => {
    it('should create a group slot with UUID-based ID', async () => {
      await slotBuilder.createImportGroup('My Import');

      expect(mockClient.addSlot).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 'Root',
          name: 'My Import',
          position: { x: 0, y: IMPORT_GROUP_Y_OFFSET, z: 0 },
          scale: { x: IMPORT_GROUP_SCALE, y: IMPORT_GROUP_SCALE, z: IMPORT_GROUP_SCALE },
          tag: IMPORT_ROOT_TAG,
        })
      );

      const callArgs = mockClient.addSlot.mock.calls[0][0] as { id: string };
      expect(callArgs.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
      expect(mockClient.addComponent).toHaveBeenCalledWith({
        id: `${callArgs.id}-object-root`,
        slotId: callArgs.id,
        componentType: '[FrooxEngine]FrooxEngine.ObjectRoot',
        fields: {},
      });
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

    it('should apply preserved transform when provided', async () => {
      await slotBuilder.createImportGroup('My Import', {
        position: { x: 10, y: 20, z: 30 },
        rotation: { x: 0, y: 0.7071, z: 0, w: 0.7071 },
        scale: { x: 2, y: 2, z: 2 },
      });

      expect(mockClient.addSlot).toHaveBeenCalledWith(
        expect.objectContaining({
          position: { x: 10, y: 20, z: 30 },
          rotation: { x: 0, y: 0.7071, z: 0, w: 0.7071 },
          scale: { x: 2, y: 2, z: 2 },
        })
      );
    });
  });
});
