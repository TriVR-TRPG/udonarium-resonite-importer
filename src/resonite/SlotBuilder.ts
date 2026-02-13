/**
 * Helper for building Resonite slots from Udonarium objects
 */

import { randomUUID } from 'crypto';
import { ResoniteObject, Vector3 } from '../domain/ResoniteObject';
import { SharedMeshDefinition } from '../converter/sharedMesh';
import { SharedMaterialDefinition } from '../converter/sharedMaterial';
import { IMPORT_GROUP_SCALE, IMPORT_ROOT_TAG } from '../config/MappingConfig';
import { ResoniteLinkClient, SlotTransform } from './ResoniteLinkClient';

const SLOT_ID_PREFIX = 'udon-imp';
const GIF_EXTENSION_PATTERN = /\.gif(?:$|[?#])/i;

function shouldUsePointFilterMode(identifier: string, textureUrl: string): boolean {
  return GIF_EXTENSION_PATTERN.test(identifier) || GIF_EXTENSION_PATTERN.test(textureUrl);
}

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

export interface SlotBuildResult {
  slotId: string;
  success: boolean;
  error?: string;
}

export class SlotBuilder {
  private client: ResoniteLinkClient;
  private rootSlotId: string;
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
      //  2. updateListFields: add elements → fetch element IDs → set references
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
    const results: SlotBuildResult[] = [];
    const total = objects.length;

    for (let i = 0; i < objects.length; i++) {
      const result = await this.buildSlot(objects[i]);
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
  async createImportGroup(name: string, transform?: SlotTransform): Promise<string> {
    const groupId = `${SLOT_ID_PREFIX}-${randomUUID()}`;
    const position: Vector3 = transform?.position ?? { x: 0, y: 0, z: 0 };
    const scale: Vector3 = transform?.scale ?? {
      x: IMPORT_GROUP_SCALE,
      y: IMPORT_GROUP_SCALE,
      z: IMPORT_GROUP_SCALE,
    };

    await this.client.addSlot({
      id: groupId,
      parentId: this.rootSlotId,
      name,
      position,
      ...(transform?.rotation ? { rotation: transform.rotation } : {}),
      scale,
      tag: IMPORT_ROOT_TAG,
    });

    this.rootSlotId = groupId;
    return groupId;
  }

  async createTextureAssets(textureMap: Map<string, string>): Promise<Map<string, string>> {
    const textureReferenceMap = new Map<string, string>();
    const importableTextures = Array.from(textureMap.entries());

    if (importableTextures.length === 0) {
      return textureReferenceMap;
    }

    const texturesSlotId = await this.ensureTexturesSlot();

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
        componentType: '[FrooxEngine]FrooxEngine.StaticTexture2D',
        fields: {
          URL: { $type: 'Uri', value: textureUrl },
          WrapModeU: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
          WrapModeV: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
          ...(shouldUsePointFilterMode(identifier, textureUrl)
            ? {
                FilterMode: {
                  $type: 'enum?',
                  value: 'Point',
                  enumType: 'TextureFilterMode',
                },
              }
            : {}),
        },
      });
      await this.client.addComponent({
        id: `${textureSlotId}-main-texture-property-block`,
        slotId: textureSlotId,
        componentType: '[FrooxEngine]FrooxEngine.MainTexturePropertyBlock',
        fields: {
          Texture: { $type: 'reference', targetId: textureComponentId },
        },
      });

      textureReferenceMap.set(identifier, textureComponentId);
    }

    return textureReferenceMap;
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
