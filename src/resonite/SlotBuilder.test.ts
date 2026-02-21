import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { SlotBuilder } from './SlotBuilder';
import { ResoniteLinkClient } from './ResoniteLinkClient';
import { ResoniteObject } from '../domain/ResoniteObject';
import {
  IMPORT_GROUP_SCALE,
  IMPORT_GROUP_Y_OFFSET,
  IMPORT_ROOT_TAG,
} from '../config/MappingConfig';
import { COMPONENT_TYPES } from '../config/ResoniteComponentTypes';
import { ImageAssetInfo } from '../converter/imageAssetContext';

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

function makeImageAssetInfoMap(entries: Array<[string, string]>): Map<string, ImageAssetInfo> {
  return new Map(
    entries.map(([identifier, textureValue]) => [identifier, { identifier, textureValue }])
  );
}

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

  const createTextureAssetsViaUpdater = async (
    imageAssetInfoMap: Map<string, ImageAssetInfo>
  ): Promise<Map<string, string>> => {
    const textureReferenceMap = new Map<string, string>();
    await slotBuilder.createTextureAssetsWithUpdater(
      imageAssetInfoMap,
      (identifier, textureComponentId) => {
        textureReferenceMap.set(identifier, textureComponentId);
      }
    );
    return textureReferenceMap;
  };

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
        isActive: true,
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
        isActive: true,
      });

      // Second call for child with parent's slot ID
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(2, {
        id: 'child-001',
        parentId: 'created-slot-id',
        name: 'Child Object',
        position: { x: 0, y: 0, z: 0 },
        isActive: true,
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

    it('adds SimpleAvatarProtection when slot has MeshRenderer', async () => {
      const obj = createResoniteObject({
        components: [
          {
            id: 'mesh-renderer-1',
            type: COMPONENT_TYPES.MESH_RENDERER,
            fields: {},
          },
        ],
      });

      await slotBuilder.buildSlot(obj);

      expect(mockClient.addComponent).toHaveBeenNthCalledWith(1, {
        id: 'mesh-renderer-1',
        slotId: 'created-slot-id',
        componentType: COMPONENT_TYPES.MESH_RENDERER,
        fields: {},
      });
      expect(mockClient.addComponent).toHaveBeenNthCalledWith(2, {
        id: `${obj.id}-simple-avatar-protection`,
        slotId: 'created-slot-id',
        componentType: COMPONENT_TYPES.SIMPLE_AVATAR_PROTECTION,
        fields: {},
      });
    });

    it('does not add duplicate SimpleAvatarProtection when already present', async () => {
      const obj = createResoniteObject({
        components: [
          {
            id: 'mesh-renderer-1',
            type: COMPONENT_TYPES.MESH_RENDERER,
            fields: {},
          },
          {
            id: 'sap-1',
            type: COMPONENT_TYPES.SIMPLE_AVATAR_PROTECTION,
            fields: {},
          },
        ],
      });

      await slotBuilder.buildSlot(obj);

      expect(mockClient.addComponent).toHaveBeenCalledTimes(2);
      expect(mockClient.addComponent).toHaveBeenNthCalledWith(1, {
        id: 'mesh-renderer-1',
        slotId: 'created-slot-id',
        componentType: COMPONENT_TYPES.MESH_RENDERER,
        fields: {},
      });
      expect(mockClient.addComponent).toHaveBeenNthCalledWith(2, {
        id: 'sap-1',
        slotId: 'created-slot-id',
        componentType: COMPONENT_TYPES.SIMPLE_AVATAR_PROTECTION,
        fields: {},
      });
    });

    it('does not add SimpleAvatarProtection when disabled', async () => {
      const obj = createResoniteObject({
        components: [
          {
            id: 'mesh-renderer-1',
            type: COMPONENT_TYPES.MESH_RENDERER,
            fields: {},
          },
        ],
      });

      await slotBuilder.buildSlot(obj, undefined, { enableSimpleAvatarProtection: false });

      expect(mockClient.addComponent).toHaveBeenCalledTimes(1);
      expect(mockClient.addComponent).toHaveBeenNthCalledWith(1, {
        id: 'mesh-renderer-1',
        slotId: 'created-slot-id',
        componentType: COMPONENT_TYPES.MESH_RENDERER,
        fields: {},
      });
    });

    it('adds SimpleAvatarProtection to Udonarium object root even without MeshRenderer', async () => {
      const obj = createResoniteObject({ components: [], sourceType: 'text-note' });

      await slotBuilder.buildSlot(obj);

      expect(mockClient.addComponent).toHaveBeenCalledTimes(1);
      expect(mockClient.addComponent).toHaveBeenCalledWith({
        id: `${obj.id}-simple-avatar-protection`,
        slotId: 'created-slot-id',
        componentType: COMPONENT_TYPES.SIMPLE_AVATAR_PROTECTION,
        fields: {},
      });
    });

    it('does not add object-root SimpleAvatarProtection to child slots without MeshRenderer', async () => {
      const parentObj = createResoniteObject({
        id: 'parent-001',
        children: [createResoniteObject({ id: 'child-001', components: [] })],
        components: [],
        sourceType: 'card',
      });

      await slotBuilder.buildSlot(parentObj);

      const sapCalls = mockClient.addComponent.mock.calls.filter(
        (call) =>
          (call[0] as { componentType: string }).componentType ===
          COMPONENT_TYPES.SIMPLE_AVATAR_PROTECTION
      );
      expect(sapCalls).toHaveLength(1);
      expect(sapCalls[0]?.[0]).toMatchObject({
        id: 'parent-001-simple-avatar-protection',
      });
    });

    it('adds object-root SimpleAvatarProtection to child slots when child has Udonarium sourceType', async () => {
      const parentObj = createResoniteObject({
        id: 'table-001',
        components: [],
        sourceType: 'table',
        children: [
          createResoniteObject({ id: 'terrain-001', components: [], sourceType: 'terrain' }),
        ],
      });

      await slotBuilder.buildSlot(parentObj);

      const sapIds = mockClient.addComponent.mock.calls
        .filter(
          (call) =>
            (call[0] as { componentType: string }).componentType ===
            COMPONENT_TYPES.SIMPLE_AVATAR_PROTECTION
        )
        .map((call) => (call[0] as { id: string }).id);

      expect(sapIds).toContain('table-001-simple-avatar-protection');
      expect(sapIds).toContain('terrain-001-simple-avatar-protection');
    });

    it('does not add object-root SimpleAvatarProtection when sourceType is missing', async () => {
      const obj = createResoniteObject({ components: [] });

      await slotBuilder.buildSlot(obj);

      const hasProtection = mockClient.addComponent.mock.calls.some(
        (call) =>
          (call[0] as { componentType: string }).componentType ===
          COMPONENT_TYPES.SIMPLE_AVATAR_PROTECTION
      );
      expect(hasProtection).toBe(false);
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
      expect(mockClient.addSlot).toHaveBeenCalledTimes(8);
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          parentId: 'Root',
          name: 'Offset',
        })
      );
      const offsetCallArgs = mockClient.addSlot.mock.calls[0][0] as { id: string };
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          parentId: offsetCallArgs.id,
          name: 'Tables',
        })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          parentId: offsetCallArgs.id,
          name: 'Objects',
        })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          parentId: offsetCallArgs.id,
          name: 'Inventory',
        })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        5,
        expect.objectContaining({
          name: 'table',
          isActive: true,
        })
      );
      const objectsCallArgs = mockClient.addSlot.mock.calls[2][0] as { id: string };
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        6,
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

      const tablesSlotCall = mockClient.addSlot.mock.calls[1][0] as { id: string };
      const objectsSlotCall = mockClient.addSlot.mock.calls[2][0] as { id: string };
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        6,
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

    it('creates Offset slot positioned to center the largest table', async () => {
      const largeTable = createResoniteObject({
        id: 'table-large',
        sourceType: 'table',
        position: { x: 20, y: 0, z: -10 },
        children: [
          createResoniteObject({
            id: 'table-large-surface',
            position: { x: 10, y: 0, z: -5 },
          }),
        ],
      });
      const smallTable = createResoniteObject({
        id: 'table-small',
        sourceType: 'table',
        position: { x: 5, y: 0, z: 5 },
        children: [
          createResoniteObject({
            id: 'table-small-surface',
            position: { x: 2, y: 0, z: -2 },
          }),
        ],
      });

      await slotBuilder.buildSlots([smallTable, largeTable]);

      const offsetCall = mockClient.addSlot.mock.calls[0]?.[0] as
        | { name?: string; parentId?: string; position?: { x: number; y: number; z: number } }
        | undefined;
      expect(offsetCall?.name).toBe('Offset');
      expect(offsetCall?.parentId).toBe('Root');
      expect(offsetCall?.position?.x).toBe(-30);
      expect(offsetCall?.position?.z).toBe(15);
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

      const inventorySlotCall = mockClient.addSlot.mock.calls[3][0] as { id: string };
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        5,
        expect.objectContaining({
          parentId: inventorySlotCall.id,
          name: 'table',
          isActive: true,
        })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        6,
        expect.objectContaining({
          parentId: inventorySlotCall.id,
          name: 'graveyard',
          isActive: false,
        })
      );
      const graveyardSlotCall = mockClient.addSlot.mock.calls[5][0] as { id: string };
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        7,
        expect.objectContaining({ id: 'char-graveyard', parentId: graveyardSlotCall.id })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        8,
        expect.objectContaining({
          parentId: inventorySlotCall.id,
          name: 'Unknown',
          isActive: false,
        })
      );
      const unknownSlotCall = mockClient.addSlot.mock.calls[7][0] as { id: string };
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        9,
        expect.objectContaining({ id: 'char-common', parentId: unknownSlotCall.id })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        10,
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
        if (callCount === 7) {
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
        expect.objectContaining({ name: 'Offset', parentId: 'Root' })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ name: 'Tables' })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ name: 'Objects' })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({ name: 'Inventory' })
      );
      expect(mockClient.addSlot).toHaveBeenNthCalledWith(
        5,
        expect.objectContaining({ name: 'table', isActive: true })
      );
    });

    it('adds SimpleAvatarProtection to each top-level object root slot', async () => {
      const objects = [
        createResoniteObject({ id: 'obj-1', name: 'Object 1', sourceType: 'card' }),
        createResoniteObject({ id: 'obj-2', name: 'Object 2', sourceType: 'terrain' }),
      ];

      await slotBuilder.buildSlots(objects);

      expect(mockClient.addComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'obj-1-simple-avatar-protection',
          componentType: COMPONENT_TYPES.SIMPLE_AVATAR_PROTECTION,
        })
      );
      expect(mockClient.addComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'obj-2-simple-avatar-protection',
          componentType: COMPONENT_TYPES.SIMPLE_AVATAR_PROTECTION,
        })
      );
    });
  });

  describe('createTextureAssets', () => {
    it('can apply texture references via updater callback without exposing map', async () => {
      const imageAssetInfoMap = makeImageAssetInfoMap([['card-front.png', 'resdb:///card-front']]);
      const updateTextureReference = vi.fn();

      await slotBuilder.createTextureAssetsWithUpdater(imageAssetInfoMap, updateTextureReference);

      expect(updateTextureReference).toHaveBeenCalledTimes(1);
      expect(updateTextureReference).toHaveBeenCalledWith(
        'card-front.png',
        expect.stringMatching(/-static-texture$/)
      );
    });

    it('should create shared texture slots under Assets/Textures', async () => {
      const imageAssetInfoMap = makeImageAssetInfoMap([['card-front.png', 'resdb:///card-front']]);

      const result = await createTextureAssetsViaUpdater(imageAssetInfoMap);

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
      expect(firstComponentCall.componentType).toBe(COMPONENT_TYPES.STATIC_TEXTURE_2D);
      expect(firstComponentCall.fields).toMatchObject({
        URL: { $type: 'Uri', value: 'resdb:///card-front' },
      });

      const secondComponentCall = mockClient.addComponent.mock.calls[1][0] as {
        componentType: string;
        fields: Record<string, unknown>;
      };
      expect(secondComponentCall.componentType).toBe(COMPONENT_TYPES.MAIN_TEXTURE_PROPERTY_BLOCK);
      const textureField = secondComponentCall.fields.Texture as
        | { $type?: string; targetId?: string }
        | undefined;
      expect(textureField?.$type).toBe('reference');
      expect(textureField?.targetId).toMatch(/-static-texture$/);

      expect(result.get('card-front.png')).toMatch(/-static-texture$/);
    });

    it('should create shared texture assets for external URLs', async () => {
      const imageAssetInfoMap = makeImageAssetInfoMap([
        ['external-image', 'https://example.com/image.png'],
      ]);

      const result = await createTextureAssetsViaUpdater(imageAssetInfoMap);

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
      expect(firstComponentCall.componentType).toBe(COMPONENT_TYPES.STATIC_TEXTURE_2D);
      expect(firstComponentCall.fields).toMatchObject({
        URL: { $type: 'Uri', value: 'https://example.com/image.png' },
      });

      expect(result.get('external-image')).toMatch(/-static-texture$/);
    });
    it('should set point filter mode for gif identifiers', async () => {
      const imageAssetInfoMap = makeImageAssetInfoMap([['anim.GIF', 'resdb:///anim']]);

      await createTextureAssetsViaUpdater(imageAssetInfoMap);

      const addComponentCall = mockClient.addComponent.mock.calls[0][0] as {
        fields: Record<string, unknown>;
      };
      expect(addComponentCall.fields).toHaveProperty('FilterMode');
    });

    it('should set point filter mode for gif external URLs', async () => {
      const imageAssetInfoMap = makeImageAssetInfoMap([
        ['external-image', 'https://example.com/anim.gif'],
      ]);

      await createTextureAssetsViaUpdater(imageAssetInfoMap);

      const addComponentCall = mockClient.addComponent.mock.calls[0][0] as {
        fields: Record<string, unknown>;
      };
      expect(addComponentCall.fields).toHaveProperty('FilterMode');
    });

    it('adds SimpleAvatarProtection to StaticTexture2D slots by default', async () => {
      const imageAssetInfoMap = makeImageAssetInfoMap([['card-front.png', 'resdb:///card-front']]);

      await createTextureAssetsViaUpdater(imageAssetInfoMap);

      const protectionCall = mockClient.addComponent.mock.calls.find(
        (call) =>
          (call[0] as { componentType: string }).componentType ===
          COMPONENT_TYPES.SIMPLE_AVATAR_PROTECTION
      );
      expect(protectionCall).toBeDefined();
    });

    it('does not add SimpleAvatarProtection to StaticTexture2D slots when disabled', async () => {
      const imageAssetInfoMap = makeImageAssetInfoMap([['card-front.png', 'resdb:///card-front']]);

      await slotBuilder.createTextureAssetsWithUpdater(imageAssetInfoMap, () => undefined, false);

      const hasProtection = mockClient.addComponent.mock.calls.some(
        (call) =>
          (call[0] as { componentType: string }).componentType ===
          COMPONENT_TYPES.SIMPLE_AVATAR_PROTECTION
      );
      expect(hasProtection).toBe(false);
    });
  });

  describe('createMeshAssets', () => {
    it('should create shared mesh slots under Assets/Meshes', async () => {
      const result = await slotBuilder.createMeshAssets([
        {
          key: 'box:1,1,1',
          name: 'BoxMesh_1x1x1',
          componentType: COMPONENT_TYPES.BOX_MESH,
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
      expect(firstComponentCall.componentType).toBe(COMPONENT_TYPES.BOX_MESH);
      expect(firstComponentCall.fields).toMatchObject({
        Size: { $type: 'float3', value: { x: 1, y: 1, z: 1 } },
      });

      expect(result.get('box:1,1,1')).toMatch(/-mesh$/);
    });

    it('should reuse existing Assets slot when texture assets already exist', async () => {
      await createTextureAssetsViaUpdater(makeImageAssetInfoMap([['a.png', 'resdb:///a']]));
      mockClient.addSlot.mockClear();

      await slotBuilder.createMeshAssets([
        {
          key: 'quad:2,3',
          name: 'QuadMesh_2x3',
          componentType: COMPONENT_TYPES.QUAD_MESH,
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
          componentType: COMPONENT_TYPES.XIEXE_TOON_MATERIAL,
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
      expect(firstComponentCall.componentType).toBe(COMPONENT_TYPES.XIEXE_TOON_MATERIAL);
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
        componentType: COMPONENT_TYPES.OBJECT_ROOT,
        fields: {},
      });
      expect(mockClient.addComponent).toHaveBeenCalledWith({
        id: `${callArgs.id}-simple-avatar-protection`,
        slotId: callArgs.id,
        componentType: COMPONENT_TYPES.SIMPLE_AVATAR_PROTECTION,
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

    it('should add Grabbable to root container when enabled', async () => {
      await slotBuilder.createImportGroup('My Import', undefined, undefined, true);

      const callArgs = mockClient.addSlot.mock.calls[0][0] as { id: string };
      expect(mockClient.addComponent).toHaveBeenNthCalledWith(3, {
        id: `${callArgs.id}-grabbable`,
        slotId: callArgs.id,
        componentType: COMPONENT_TYPES.GRABBABLE,
        fields: {
          Scalable: { $type: 'bool', value: true },
        },
      });
    });

    it('should not add SimpleAvatarProtection to import root when disabled', async () => {
      await slotBuilder.createImportGroup('My Import', undefined, undefined, false, false);

      const hasProtection = mockClient.addComponent.mock.calls.some(
        (call) =>
          (call[0] as { componentType: string }).componentType ===
          COMPONENT_TYPES.SIMPLE_AVATAR_PROTECTION
      );
      expect(hasProtection).toBe(false);
    });
  });
});
