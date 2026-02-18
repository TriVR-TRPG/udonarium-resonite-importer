import { ResoniteComponent, ResoniteObject } from '../domain/ResoniteObject';
import {
  BlendModeValue,
  ColorXValue,
  isGifTexture,
  parseTextureReferenceId,
  toSharedTexturePropertyBlockId,
} from './textureUtils';

// ---- private types ----
type QuadSize = { x: number; y: number };
type BoxSize = { x: number; y: number; z: number };

type ResoniteObjectSpec = Omit<ResoniteObject, 'components' | 'children'>;

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
  Color?: { $type: 'colorX'; value: ColorXValue };
};

// ---- private helpers ----
function createBlendModeField(blendMode: BlendModeValue): BlendModeField {
  return { $type: 'enum', value: blendMode, enumType: 'BlendMode' };
}

function buildXiexeToonMaterialFields(
  blendMode: BlendModeValue = 'Cutout',
  color?: ColorXValue
): XiexeToonMaterialFields {
  return {
    BlendMode: createBlendModeField(blendMode),
    ShadowRamp: { $type: 'reference', targetId: null },
    ShadowSharpness: { $type: 'float', value: 0 },
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
      type: '[FrooxEngine]FrooxEngine.QuadMesh',
      fields: {
        Size: { $type: 'float2', value: size },
        ...(dualSided ? { DualSided: { $type: 'bool', value: true } } : {}),
      },
    },
  ];

  if (textureValue && !sharedTextureId) {
    components.push({
      id: textureId,
      type: '[FrooxEngine]FrooxEngine.StaticTexture2D',
      fields: buildStaticTexture2DFields(textureValue),
    });
  }

  components.push({
    id: materialId,
    type: '[FrooxEngine]FrooxEngine.XiexeToonMaterial',
    fields: buildXiexeToonMaterialFields(blendMode, color),
  });

  if (textureValue && !sharedTextureId) {
    const textureProviderId = sharedTextureId ?? localTextureId!;
    const textureBlockFields: MainTexturePropertyBlockFields = {
      Texture: { $type: 'reference', targetId: textureProviderId },
    };
    components.push({
      id: textureBlockId,
      type: '[FrooxEngine]FrooxEngine.MainTexturePropertyBlock',
      fields: textureBlockFields,
    });
  }

  components.push({
    id: `${slotId}-renderer`,
    type: '[FrooxEngine]FrooxEngine.MeshRenderer',
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
    type: '[FrooxEngine]FrooxEngine.BoxCollider',
    fields: {
      Size: { $type: 'float3', value: size },
      ...(options?.characterCollider ? { CharacterCollider: { $type: 'bool', value: true } } : {}),
    },
  };
}

function buildGrabbableComponent(slotId: string): ResoniteComponent {
  return {
    id: `${slotId}-grabbable`,
    type: '[FrooxEngine]FrooxEngine.Grabbable',
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
  private readonly obj: ResoniteObject;

  constructor(spec: ResoniteObjectSpec) {
    this.obj = {
      ...spec,
      components: [],
      children: [],
    };
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
      type: '[FrooxEngine]FrooxEngine.UIX.Text',
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
    return {
      ...this.obj,
      components: [...this.obj.components],
      children: [...this.obj.children],
    };
  }
}
