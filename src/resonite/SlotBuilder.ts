/**
 * Helper for building Resonite slots from Udonarium objects
 */

import { randomUUID } from 'crypto';
import { CharacterResoniteObject, ResoniteObject, Vector3 } from '../domain/ResoniteObject';
import { SharedMeshDefinition } from '../converter/sharedMesh';
import { SharedMaterialDefinition } from '../converter/sharedMaterial';
import {
  IMPORT_GROUP_SCALE,
  IMPORT_GROUP_Y_OFFSET,
  IMPORT_ROOT_TAG,
  SLOT_ID_PREFIX,
} from '../config/MappingConfig';
import { COMPONENT_TYPES } from '../config/ResoniteComponentTypes';
import {
  buildStaticTexture2DFields,
  buildMainTexturePropertyBlockFields,
} from '../converter/componentFields';
import { buildImageFilterModeMap } from '../converter/imageAssetContext';
import { ResoniteLinkClient, SlotTransform } from './ResoniteLinkClient';

function isListField(value: unknown): boolean {
  return (
    !!value && typeof value === 'object' && (value as Record<string, unknown>).$type === 'list'
  );
}

function splitListFields(fields: Record<string, unknown>): {
  creationFields: Record<string, unknown>;
  listFields: Record<string, unknown>;
} {
  const creationFields: Record<string, unknown> = {};
  const listFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (isListField(value)) {
      listFields[key] = value;
    } else {
      creationFields[key] = value;
    }
  }
  return { creationFields, listFields };
}

function isTableRootObject(obj: ResoniteObject): boolean {
  return obj.children.some((child) => child.id.endsWith('-surface'));
}

function isCharacterObject(obj: ResoniteObject): obj is CharacterResoniteObject {
  return obj.sourceType === 'character';
}

export interface SlotBuildResult {
  slotId: string;
  success: boolean;
  error?: string;
}

export type TextureReferenceUpdater = (
  identifier: string,
  textureComponentId: string
) => void | Promise<void>;

export class SlotBuilder {
  private client: ResoniteLinkClient;
  private rootSlotId: string;
  private tablesSlotId?: string;
  private objectsSlotId?: string;
  private inventorySlotId?: string;
  private inventoryLocationSlotIds = new Map<string, string>();
  private assetsSlotId?: string;
  private texturesSlotId?: string;
  private meshesSlotId?: string;
  private materialsSlotId?: string;

  constructor(client: ResoniteLinkClient, rootSlotId = 'Root') {
    this.client = client;
    this.rootSlotId = rootSlotId;
  }

  /**
   * Build a slot from a Resonite object
   */
  async buildSlot(obj: ResoniteObject, parentId?: string): Promise<SlotBuildResult> {
    try {
      const slotId = await this.client.addSlot({
        id: obj.id,
        parentId: parentId || this.rootSlotId,
        name: obj.name,
        position: obj.position,
        ...(obj.isActive !== undefined ? { isActive: obj.isActive } : {}),
      });

      // Set rotation if not zero
      if (obj.rotation.x !== 0 || obj.rotation.y !== 0 || obj.rotation.z !== 0) {
        await this.client.updateSlot({
          id: slotId,
          rotation: obj.rotation,
        });
      }

      // Attach components in the order they are defined.
      // SyncList fields (e.g. Materials) require a 2-step update protocol:
      //  1. addComponent with non-list fields only
      //  2. updateListFields: add elements, fetch element IDs, set references
      for (const component of obj.components) {
        const { creationFields, listFields } = splitListFields(component.fields);

        const componentId = await this.client.addComponent({
          id: component.id,
          slotId,
          componentType: component.type,
          fields: creationFields,
        });

        if (Object.keys(listFields).length > 0) {
          await this.client.updateListFields(componentId, listFields);
        }
      }

      // Build children recursively
      for (const child of obj.children) {
        await this.buildSlot(child, slotId);
      }

      return { slotId, success: true };
    } catch (error) {
      return {
        slotId: obj.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build multiple slots
   */
  async buildSlots(
    objects: ResoniteObject[],
    onProgress?: (current: number, total: number) => void
  ): Promise<SlotBuildResult[]> {
    if (objects.length === 0) {
      return [];
    }

    const results: SlotBuildResult[] = [];
    const total = objects.length;

    for (let i = 0; i < objects.length; i++) {
      const object = objects[i];
      let result: SlotBuildResult;
      try {
        const { tablesSlotId, objectsSlotId, inventorySlotId } =
          await this.ensureTopLevelObjectSlots();
        const isTable = isTableRootObject(object) || object.sourceType === 'table';
        const isInventoryObject = !isTable && isCharacterObject(object);
        const parentId = isTable
          ? tablesSlotId
          : isInventoryObject
            ? await this.ensureInventoryLocationSlot(object.locationName, inventorySlotId)
            : objectsSlotId;
        result = await this.buildSlot(object, parentId);
      } catch (error) {
        result = {
          slotId: object.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
      results.push(result);

      if (onProgress) {
        onProgress(i + 1, total);
      }
    }

    return results;
  }

  /**
   * Create a group slot to contain imported objects
   */
  async createImportGroup(
    name: string,
    transform?: SlotTransform,
    defaultScale?: Vector3,
    enableRootGrabbable = false
  ): Promise<string> {
    const groupId = `${SLOT_ID_PREFIX}-${randomUUID()}`;
    const position: Vector3 = transform?.position ?? { x: 0, y: IMPORT_GROUP_Y_OFFSET, z: 0 };
    const fallbackScale: Vector3 = defaultScale ?? {
      x: IMPORT_GROUP_SCALE,
      y: IMPORT_GROUP_SCALE,
      z: IMPORT_GROUP_SCALE,
    };
    const scale: Vector3 = transform?.scale ?? fallbackScale;

    await this.client.addSlot({
      id: groupId,
      parentId: this.rootSlotId,
      name,
      position,
      ...(transform?.rotation ? { rotation: transform.rotation } : {}),
      scale,
      tag: IMPORT_ROOT_TAG,
    });
    await this.client.addComponent({
      id: `${groupId}-object-root`,
      slotId: groupId,
      componentType: COMPONENT_TYPES.OBJECT_ROOT,
      fields: {},
    });
    if (enableRootGrabbable) {
      await this.client.addComponent({
        id: `${groupId}-grabbable`,
        slotId: groupId,
        componentType: COMPONENT_TYPES.GRABBABLE,
        fields: {
          Scalable: { $type: 'bool', value: true },
        },
      });
    }

    this.rootSlotId = groupId;
    this.tablesSlotId = undefined;
    this.objectsSlotId = undefined;
    this.inventorySlotId = undefined;
    this.inventoryLocationSlotIds.clear();
    this.assetsSlotId = undefined;
    this.texturesSlotId = undefined;
    this.meshesSlotId = undefined;
    this.materialsSlotId = undefined;
    return groupId;
  }

  async createTextureAssetsWithUpdater(
    textureMap: Map<string, string>,
    updateTextureReference: TextureReferenceUpdater
  ): Promise<void> {
    const importableTextures = Array.from(textureMap.entries());

    if (importableTextures.length === 0) {
      return;
    }

    const texturesSlotId = await this.ensureTexturesSlot();
    const filterModeMap = buildImageFilterModeMap(textureMap);

    for (const [identifier, textureUrl] of importableTextures) {
      const textureSlotId = `${SLOT_ID_PREFIX}-${randomUUID()}`;
      await this.client.addSlot({
        id: textureSlotId,
        parentId: texturesSlotId,
        name: identifier,
        position: { x: 0, y: 0, z: 0 },
      });

      const textureComponentId = `${textureSlotId}-static-texture`;
      await this.client.addComponent({
        id: textureComponentId,
        slotId: textureSlotId,
        componentType: COMPONENT_TYPES.STATIC_TEXTURE_2D,
        fields: buildStaticTexture2DFields(textureUrl, filterModeMap.get(identifier) === 'Point'),
      });
      await this.client.addComponent({
        id: `${textureSlotId}-main-texture-property-block`,
        slotId: textureSlotId,
        componentType: COMPONENT_TYPES.MAIN_TEXTURE_PROPERTY_BLOCK,
        fields: buildMainTexturePropertyBlockFields(textureComponentId),
      });

      await updateTextureReference(identifier, textureComponentId);
    }
  }

  async createMeshAssets(meshDefinitions: SharedMeshDefinition[]): Promise<Map<string, string>> {
    const meshReferenceMap = new Map<string, string>();

    if (meshDefinitions.length === 0) {
      return meshReferenceMap;
    }

    const meshesSlotId = await this.ensureMeshesSlot();

    for (const meshDefinition of meshDefinitions) {
      const meshSlotId = `${SLOT_ID_PREFIX}-${randomUUID()}`;
      await this.client.addSlot({
        id: meshSlotId,
        parentId: meshesSlotId,
        name: meshDefinition.name,
        position: { x: 0, y: 0, z: 0 },
      });

      const meshComponentId = `${meshSlotId}-mesh`;
      await this.client.addComponent({
        id: meshComponentId,
        slotId: meshSlotId,
        componentType: meshDefinition.componentType,
        fields: {
          Size: { $type: meshDefinition.sizeFieldType, value: meshDefinition.sizeValue },
          ...(meshDefinition.dualSided ? { DualSided: { $type: 'bool', value: true } } : {}),
        },
      });

      meshReferenceMap.set(meshDefinition.key, meshComponentId);
    }

    return meshReferenceMap;
  }

  async createMaterialAssets(
    materialDefinitions: SharedMaterialDefinition[]
  ): Promise<Map<string, string>> {
    const materialReferenceMap = new Map<string, string>();

    if (materialDefinitions.length === 0) {
      return materialReferenceMap;
    }

    const materialsSlotId = await this.ensureMaterialsSlot();

    for (const materialDefinition of materialDefinitions) {
      const materialSlotId = `${SLOT_ID_PREFIX}-${randomUUID()}`;
      await this.client.addSlot({
        id: materialSlotId,
        parentId: materialsSlotId,
        name: materialDefinition.name,
        position: { x: 0, y: 0, z: 0 },
      });

      const materialComponentId = `${materialSlotId}-material`;
      await this.client.addComponent({
        id: materialComponentId,
        slotId: materialSlotId,
        componentType: materialDefinition.componentType,
        fields: materialDefinition.fields,
      });

      materialReferenceMap.set(materialDefinition.key, materialComponentId);
    }

    return materialReferenceMap;
  }

  private async ensureAssetsSlot(): Promise<string> {
    if (this.assetsSlotId) {
      return this.assetsSlotId;
    }
    this.assetsSlotId = `${SLOT_ID_PREFIX}-${randomUUID()}`;
    await this.client.addSlot({
      id: this.assetsSlotId,
      parentId: this.rootSlotId,
      name: 'Assets',
      position: { x: 0, y: 0, z: 0 },
    });
    return this.assetsSlotId;
  }

  private async ensureTopLevelObjectSlots(): Promise<{
    tablesSlotId: string;
    objectsSlotId: string;
    inventorySlotId: string;
  }> {
    if (!this.tablesSlotId) {
      this.tablesSlotId = `${SLOT_ID_PREFIX}-${randomUUID()}`;
      await this.client.addSlot({
        id: this.tablesSlotId,
        parentId: this.rootSlotId,
        name: 'Tables',
        position: { x: 0, y: 0, z: 0 },
      });
    }

    if (!this.objectsSlotId) {
      this.objectsSlotId = `${SLOT_ID_PREFIX}-${randomUUID()}`;
      await this.client.addSlot({
        id: this.objectsSlotId,
        parentId: this.rootSlotId,
        name: 'Objects',
        position: { x: 0, y: 0, z: 0 },
      });
    }

    if (!this.inventorySlotId) {
      this.inventorySlotId = `${SLOT_ID_PREFIX}-${randomUUID()}`;
      await this.client.addSlot({
        id: this.inventorySlotId,
        parentId: this.rootSlotId,
        name: 'Inventory',
        position: { x: 0, y: 0, z: 0 },
      });
    }
    // "table" inventory location is always present and should remain visible.
    await this.ensureInventoryLocationSlot('table', this.inventorySlotId);

    return {
      tablesSlotId: this.tablesSlotId,
      objectsSlotId: this.objectsSlotId,
      inventorySlotId: this.inventorySlotId,
    };
  }

  private async ensureInventoryLocationSlot(
    locationName: string | undefined,
    inventorySlotId: string
  ): Promise<string> {
    const normalizedLocationName = locationName?.trim() || 'Unknown';
    const existingSlotId = this.inventoryLocationSlotIds.get(normalizedLocationName);
    if (existingSlotId) {
      return existingSlotId;
    }

    const slotId = `${SLOT_ID_PREFIX}-${randomUUID()}`;
    await this.client.addSlot({
      id: slotId,
      parentId: inventorySlotId,
      name: normalizedLocationName,
      position: { x: 0, y: 0, z: 0 },
      isActive: normalizedLocationName === 'table',
    });
    this.inventoryLocationSlotIds.set(normalizedLocationName, slotId);
    return slotId;
  }

  private async ensureTexturesSlot(): Promise<string> {
    if (this.texturesSlotId) {
      return this.texturesSlotId;
    }
    this.texturesSlotId = `${SLOT_ID_PREFIX}-${randomUUID()}`;
    await this.client.addSlot({
      id: this.texturesSlotId,
      parentId: await this.ensureAssetsSlot(),
      name: 'Textures',
      position: { x: 0, y: 0, z: 0 },
    });
    return this.texturesSlotId;
  }

  private async ensureMeshesSlot(): Promise<string> {
    if (this.meshesSlotId) {
      return this.meshesSlotId;
    }
    this.meshesSlotId = `${SLOT_ID_PREFIX}-${randomUUID()}`;
    await this.client.addSlot({
      id: this.meshesSlotId,
      parentId: await this.ensureAssetsSlot(),
      name: 'Meshes',
      position: { x: 0, y: 0, z: 0 },
    });
    return this.meshesSlotId;
  }

  private async ensureMaterialsSlot(): Promise<string> {
    if (this.materialsSlotId) {
      return this.materialsSlotId;
    }
    this.materialsSlotId = `${SLOT_ID_PREFIX}-${randomUUID()}`;
    await this.client.addSlot({
      id: this.materialsSlotId,
      parentId: await this.ensureAssetsSlot(),
      name: 'Materials',
      position: { x: 0, y: 0, z: 0 },
    });
    return this.materialsSlotId;
  }
}
