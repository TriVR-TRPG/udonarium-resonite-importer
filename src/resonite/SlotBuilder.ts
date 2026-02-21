/**
 * Helper for building Resonite slots from Udonarium objects
 */

import { randomUUID } from 'crypto';
import { ObjectType } from '../domain/UdonariumObject';
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
import { ImageAssetInfo } from '../converter/imageAssetContext';
import { isGifTexture } from '../converter/textureUtils';
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

const UDONARIUM_OBJECT_TYPES = new Set<ObjectType>([
  'character',
  'dice-symbol',
  'card',
  'card-stack',
  'terrain',
  'table',
  'table-mask',
  'text-note',
]);

function isUdonariumObjectRoot(obj: ResoniteObject): boolean {
  return typeof obj.sourceType === 'string' && UDONARIUM_OBJECT_TYPES.has(obj.sourceType);
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

function shouldUsePointFilter(textureInfo: ImageAssetInfo): boolean {
  if (textureInfo.filterMode) {
    return textureInfo.filterMode === 'Point';
  }
  if (textureInfo.textureValue && isGifTexture(textureInfo.textureValue)) {
    return true;
  }
  return isGifTexture(textureInfo.identifier);
}

export class SlotBuilder {
  private client: ResoniteLinkClient;
  private rootSlotId: string;
  private tablesSlotId?: string;
  private objectsSlotId?: string;
  private inventorySlotId?: string;
  private offsetSlotId?: string;
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
  async buildSlot(
    obj: ResoniteObject,
    parentId?: string,
    options?: {
      enableSimpleAvatarProtection?: boolean;
    }
  ): Promise<SlotBuildResult> {
    const enableSimpleAvatarProtection = options?.enableSimpleAvatarProtection ?? true;
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
      let hasMeshRenderer = false;
      const hasSimpleAvatarProtection = obj.components.some(
        (component) => component.type === COMPONENT_TYPES.SIMPLE_AVATAR_PROTECTION
      );
      for (const component of obj.components) {
        if (component.type === COMPONENT_TYPES.MESH_RENDERER) {
          hasMeshRenderer = true;
        }
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

      const shouldAddSimpleAvatarProtection = hasMeshRenderer || isUdonariumObjectRoot(obj);
      if (
        enableSimpleAvatarProtection &&
        shouldAddSimpleAvatarProtection &&
        !hasSimpleAvatarProtection
      ) {
        await this.addSimpleAvatarProtectionComponent(slotId, `${obj.id}-simple-avatar-protection`);
      }

      // Build children recursively
      for (const child of obj.children) {
        await this.buildSlot(child, slotId, options);
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
    onProgress?: (current: number, total: number) => void,
    options?: {
      enableSimpleAvatarProtection?: boolean;
    }
  ): Promise<SlotBuildResult[]> {
    if (objects.length === 0) {
      return [];
    }

    const results: SlotBuildResult[] = [];
    const total = objects.length;
    const offsetPosition = this.computeOffsetPositionFromLargestTableCenter(objects);

    for (let i = 0; i < objects.length; i++) {
      const object = objects[i];
      let result: SlotBuildResult;
      try {
        const { tablesSlotId, objectsSlotId, inventorySlotId } =
          await this.ensureTopLevelObjectSlots(offsetPosition);
        const isTable = isTableRootObject(object) || object.sourceType === 'table';
        const isInventoryObject = !isTable && isCharacterObject(object);
        const parentId = isTable
          ? tablesSlotId
          : isInventoryObject
            ? await this.ensureInventoryLocationSlot(object.locationName, inventorySlotId)
            : objectsSlotId;
        result = await this.buildSlot(object, parentId, options);
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
    enableRootGrabbable = false,
    enableSimpleAvatarProtection = true
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
    if (enableSimpleAvatarProtection) {
      await this.addSimpleAvatarProtectionComponent(groupId, `${groupId}-simple-avatar-protection`);
    }
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
    this.offsetSlotId = undefined;
    this.inventoryLocationSlotIds.clear();
    this.assetsSlotId = undefined;
    this.texturesSlotId = undefined;
    this.meshesSlotId = undefined;
    this.materialsSlotId = undefined;
    return groupId;
  }

  async createTextureAssetsWithUpdater(
    imageAssetInfoMap: Map<string, ImageAssetInfo>,
    updateTextureReference: TextureReferenceUpdater,
    enableSimpleAvatarProtection = true
  ): Promise<void> {
    const importableTextures = Array.from(imageAssetInfoMap.values()).filter(
      (info) => !!info.textureValue && !info.textureValue.startsWith('texture-ref://')
    );

    if (importableTextures.length === 0) {
      return;
    }

    const texturesSlotId = await this.ensureTexturesSlot();

    for (const textureInfo of importableTextures) {
      const identifier = textureInfo.identifier;
      const textureValue = textureInfo.textureValue as string;
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
        fields: buildStaticTexture2DFields(textureValue, shouldUsePointFilter(textureInfo)),
      });
      await this.client.addComponent({
        id: `${textureSlotId}-main-texture-property-block`,
        slotId: textureSlotId,
        componentType: COMPONENT_TYPES.MAIN_TEXTURE_PROPERTY_BLOCK,
        fields: buildMainTexturePropertyBlockFields(textureComponentId),
      });
      if (enableSimpleAvatarProtection) {
        await this.addSimpleAvatarProtectionComponent(
          textureSlotId,
          `${textureSlotId}-simple-avatar-protection`
        );
      }

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

  private async ensureTopLevelObjectSlots(offsetPosition: Vector3): Promise<{
    tablesSlotId: string;
    objectsSlotId: string;
    inventorySlotId: string;
  }> {
    const parentSlotId = await this.ensureOffsetSlot(offsetPosition);

    if (!this.tablesSlotId) {
      this.tablesSlotId = `${SLOT_ID_PREFIX}-${randomUUID()}`;
      await this.client.addSlot({
        id: this.tablesSlotId,
        parentId: parentSlotId,
        name: 'Tables',
        position: { x: 0, y: 0, z: 0 },
      });
    }

    if (!this.objectsSlotId) {
      this.objectsSlotId = `${SLOT_ID_PREFIX}-${randomUUID()}`;
      await this.client.addSlot({
        id: this.objectsSlotId,
        parentId: parentSlotId,
        name: 'Objects',
        position: { x: 0, y: 0, z: 0 },
      });
    }

    if (!this.inventorySlotId) {
      this.inventorySlotId = `${SLOT_ID_PREFIX}-${randomUUID()}`;
      await this.client.addSlot({
        id: this.inventorySlotId,
        parentId: parentSlotId,
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

  private async ensureOffsetSlot(position: Vector3): Promise<string> {
    if (this.offsetSlotId) {
      return this.offsetSlotId;
    }
    this.offsetSlotId = `${SLOT_ID_PREFIX}-${randomUUID()}`;
    await this.client.addSlot({
      id: this.offsetSlotId,
      parentId: this.rootSlotId,
      name: 'Offset',
      position,
    });
    return this.offsetSlotId;
  }

  private computeOffsetPositionFromLargestTableCenter(objects: ResoniteObject[]): Vector3 {
    const largestTableCenter = this.findLargestTableCenter(objects);
    if (!largestTableCenter) {
      return { x: 0, y: 0, z: 0 };
    }
    // Move all content so the largest table center becomes the local origin.
    return {
      x: -largestTableCenter.x,
      y: -largestTableCenter.y,
      z: -largestTableCenter.z,
    };
  }

  private findLargestTableCenter(objects: ResoniteObject[]): Vector3 | undefined {
    let largestArea = -1;
    let center: Vector3 | undefined;

    const visit = (obj: ResoniteObject): void => {
      const surface = obj.children.find((child) => child.id.endsWith('-surface'));
      if (surface) {
        const halfWidth = Math.abs(surface.position.x);
        const halfHeight = Math.abs(surface.position.z);
        const area = halfWidth * 2 * (halfHeight * 2);
        if (area > largestArea) {
          largestArea = area;
          center = {
            x: obj.position.x + surface.position.x,
            y: obj.position.y + surface.position.y,
            z: obj.position.z + surface.position.z,
          };
        }
      }
      for (const child of obj.children) {
        visit(child);
      }
    };

    for (const obj of objects) {
      visit(obj);
    }
    return center;
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

  private async addSimpleAvatarProtectionComponent(slotId: string, id: string): Promise<void> {
    await this.client.addComponent({
      id,
      slotId,
      componentType: COMPONENT_TYPES.SIMPLE_AVATAR_PROTECTION,
      fields: {},
    });
  }
}
