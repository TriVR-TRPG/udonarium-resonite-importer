import { ObjectType } from '../domain/UdonariumObject';
import { ResoniteComponent, ResoniteObject } from '../domain/ResoniteObject';
import { randomUUID } from 'crypto';
import {
  BlendModeValue,
  ColorXValue,
  isGifTexture,
  parseTextureReferenceId,
  toSharedTexturePropertyBlockId,
} from './textureUtils';
import { SLOT_ID_PREFIX } from '../config/MappingConfig';
import { COMPONENT_TYPES } from '../config/ResoniteComponentTypes';

// ---- private types ----
type QuadSize = { x: number; y: number };
type BoxSize = { x: number; y: number; z: number };

export type NewResoniteObjectSpec = {
  id?: string;
  name: string;
};

type ResoniteObjectIdentity = Required<NewResoniteObjectSpec>;

type StaticTexture2DFields = {
  URL: { $type: 'Uri'; value: string };
  WrapModeU: { $type: 'enum'; value: 'Clamp'; enumType: 'TextureWrapMode' };
  WrapModeV: { $type: 'enum'; value: 'Clamp'; enumType: 'TextureWrapMode' };
  FilterMode?: { $type: 'enum?'; value: 'Point'; enumType: 'TextureFilterMode' };
};

type BlendModeField = { $type: 'enum'; value: BlendModeValue; enumType: 'BlendMode' };

type MainTexturePropertyBlockFields = {
  Texture: { $type: 'reference'; targetId: string };
};

type XiexeToonMaterialFields = {
  BlendMode: BlendModeField;
  ShadowRamp: { $type: 'reference'; targetId: null };
  ShadowSharpness: { $type: 'float'; value: 0 };
  Culling?: { $type: 'enum'; value: 'Off'; enumType: 'Culling' };
  Color?: { $type: 'colorX'; value: ColorXValue };
};

// ---- private helpers ----
function createBlendModeField(blendMode: BlendModeValue): BlendModeField {
  return { $type: 'enum', value: blendMode, enumType: 'BlendMode' };
}

function buildXiexeToonMaterialFields(
  blendMode: BlendModeValue = 'Cutout',
  color?: ColorXValue,
  cullingOff = false
): XiexeToonMaterialFields {
  return {
    BlendMode: createBlendModeField(blendMode),
    ShadowRamp: { $type: 'reference', targetId: null },
    ShadowSharpness: { $type: 'float', value: 0 },
    ...(cullingOff ? { Culling: { $type: 'enum', value: 'Off', enumType: 'Culling' } } : {}),
    ...(color !== undefined ? { Color: { $type: 'colorX', value: color } } : {}),
  };
}

function buildStaticTexture2DFields(textureValue: string): StaticTexture2DFields {
  const fields: StaticTexture2DFields = {
    URL: { $type: 'Uri', value: textureValue },
    WrapModeU: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
    WrapModeV: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
  };
  if (isGifTexture(textureValue)) {
    fields.FilterMode = { $type: 'enum?', value: 'Point', enumType: 'TextureFilterMode' };
  }
  return fields;
}

function buildQuadMeshComponents(
  slotId: string,
  textureValue?: string,
  dualSided: boolean = false,
  size: QuadSize = { x: 1, y: 1 },
  blendMode: BlendModeValue = 'Cutout',
  color?: ColorXValue
): ResoniteComponent[] {
  const meshId = `${slotId}-mesh`;
  const materialId = `${slotId}-mat`;
  const textureBlockId = `${slotId}-texture-block`;
  const textureId = `${slotId}-tex`;
  const sharedTextureId = parseTextureReferenceId(textureValue);
  const localTextureId = sharedTextureId ? undefined : textureId;
  const texturePropertyBlockTargetId = textureValue
    ? sharedTextureId
      ? toSharedTexturePropertyBlockId(sharedTextureId)
      : textureBlockId
    : undefined;

  const components: ResoniteComponent[] = [
    {
      id: meshId,
      type: COMPONENT_TYPES.QUAD_MESH,
      fields: {
        Size: { $type: 'float2', value: size },
      },
    },
  ];

  if (textureValue && !sharedTextureId) {
    components.push({
      id: textureId,
      type: COMPONENT_TYPES.STATIC_TEXTURE_2D,
      fields: buildStaticTexture2DFields(textureValue),
    });
  }

  components.push({
    id: materialId,
    type: COMPONENT_TYPES.XIEXE_TOON_MATERIAL,
    fields: buildXiexeToonMaterialFields(blendMode, color, dualSided),
  });

  if (textureValue && !sharedTextureId) {
    const textureProviderId = sharedTextureId ?? localTextureId!;
    const textureBlockFields: MainTexturePropertyBlockFields = {
      Texture: { $type: 'reference', targetId: textureProviderId },
    };
    components.push({
      id: textureBlockId,
      type: COMPONENT_TYPES.MAIN_TEXTURE_PROPERTY_BLOCK,
      fields: textureBlockFields,
    });
  }

  components.push({
    id: `${slotId}-renderer`,
    type: COMPONENT_TYPES.MESH_RENDERER,
    fields: {
      Mesh: { $type: 'reference', targetId: meshId },
      Materials: {
        $type: 'list',
        elements: [{ $type: 'reference', targetId: materialId }],
      },
      ...(texturePropertyBlockTargetId
        ? {
            MaterialPropertyBlocks: {
              $type: 'list',
              elements: [{ $type: 'reference', targetId: texturePropertyBlockTargetId }],
            },
          }
        : {}),
    },
  });

  return components;
}

function buildBoxColliderComponent(
  slotId: string,
  size: BoxSize,
  options?: { characterCollider?: boolean }
): ResoniteComponent {
  return {
    id: `${slotId}-collider`,
    type: COMPONENT_TYPES.BOX_COLLIDER,
    fields: {
      Size: { $type: 'float3', value: size },
      ...(options?.characterCollider ? { CharacterCollider: { $type: 'bool', value: true } } : {}),
    },
  };
}

function buildGrabbableComponent(slotId: string): ResoniteComponent {
  return {
    id: `${slotId}-grabbable`,
    type: COMPONENT_TYPES.GRABBABLE,
    fields: {
      Scalable: { $type: 'bool', value: true },
    },
  };
}

/**
 * Fluent builder for ResoniteObject.
 *
 * Component IDs are always derived from the slot's own ID, eliminating the
 * possibility of accidentally passing a mismatched slotId to component builder functions.
 */
export class ResoniteObjectBuilder {
  private readonly obj: {
    id: string;
    name: string;
    position: ResoniteObject['position'];
    rotation: ResoniteObject['rotation'];
    sourceType?: ObjectType;
    locationName?: string;
    isActive: boolean;
    components: ResoniteComponent[];
    children: ResoniteObject[];
  };

  static create(identity: NewResoniteObjectSpec): ResoniteObjectBuilder {
    return new ResoniteObjectBuilder({
      id: identity.id ?? `${SLOT_ID_PREFIX}-${randomUUID()}`,
      name: identity.name,
    });
  }

  private constructor(identity: ResoniteObjectIdentity) {
    this.obj = {
      id: identity.id,
      name: identity.name,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      isActive: true,
      components: [],
      children: [],
    };
  }

  getId(): string {
    return this.obj.id;
  }

  setPosition(position: ResoniteObject['position']): this {
    this.obj.position = position;
    return this;
  }

  setRotation(rotation: ResoniteObject['rotation']): this {
    this.obj.rotation = rotation;
    return this;
  }

  setSourceType(sourceType: ObjectType): this {
    this.obj.sourceType = sourceType;
    if (sourceType !== 'character') {
      delete this.obj.locationName;
    }
    return this;
  }

  setLocationName(locationName: string | undefined): this {
    this.obj.locationName = locationName;
    return this;
  }

  setActive(isActive: ResoniteObject['isActive']): this {
    this.obj.isActive = isActive;
    return this;
  }

  addQuadMesh(
    textureValue?: string,
    dualSided = false,
    size: QuadSize = { x: 1, y: 1 },
    blendMode: BlendModeValue = 'Cutout',
    color?: ColorXValue
  ): this {
    this.obj.components.push(
      ...buildQuadMeshComponents(this.obj.id, textureValue, dualSided, size, blendMode, color)
    );
    return this;
  }

  addBoxCollider(size: BoxSize, options?: { characterCollider?: boolean }): this {
    this.obj.components.push(buildBoxColliderComponent(this.obj.id, size, options));
    return this;
  }

  addGrabbable(): this {
    this.obj.components.push(buildGrabbableComponent(this.obj.id));
    return this;
  }

  addTextComponent(content: string, size: number): this {
    this.obj.components.push({
      id: `${this.obj.id}-text`,
      type: COMPONENT_TYPES.UIX_TEXT,
      fields: {
        Content: { $type: 'string', value: content },
        Size: { $type: 'float', value: size },
      },
    });
    return this;
  }

  addChild(child: ResoniteObject): this {
    this.obj.children.push(child);
    return this;
  }

  addChildren(children: ResoniteObject[]): this {
    this.obj.children.push(...children);
    return this;
  }

  build(): ResoniteObject {
    const result = {
      ...this.obj,
      components: [...this.obj.components],
      children: [...this.obj.children],
    };
    if (result.sourceType !== 'character') {
      delete result.locationName;
    }
    return result as ResoniteObject;
  }
}
