import { ResoniteComponent } from '../../domain/ResoniteObject';

const TEXTURE_PLACEHOLDER_PREFIX = 'texture://';
const TEXTURE_REFERENCE_PREFIX = 'texture-ref://';
const GIF_EXTENSION_PATTERN = /\.gif(?:$|[?#])/i;
const SHARED_TEXTURE_COMPONENT_SUFFIX = '-static-texture';
const SHARED_TEXTURE_PROPERTY_BLOCK_SUFFIX = '-main-texture-property-block';

type StaticTexture2DFields = {
  URL: { $type: 'Uri'; value: string };
  WrapModeU: { $type: 'enum'; value: 'Clamp'; enumType: 'TextureWrapMode' };
  WrapModeV: { $type: 'enum'; value: 'Clamp'; enumType: 'TextureWrapMode' };
  FilterMode?: { $type: 'enum?'; value: 'Point'; enumType: 'TextureFilterMode' };
};
type QuadSize = { x: number; y: number };
type BoxSize = { x: number; y: number; z: number };

export type BlendModeValue = 'Cutout' | 'Opaque' | 'Alpha';
type BlendModeField = { $type: 'enum'; value: BlendModeValue; enumType: 'BlendMode' };
type MainTexturePropertyBlockFields = {
  Texture: { $type: 'reference'; targetId: string };
};
type XiexeToonMaterialFields = {
  BlendMode: BlendModeField;
  ShadowRamp: { $type: 'reference'; targetId: null };
  ShadowSharpness: { $type: 'float'; value: 0 };
};

function createBlendModeField(blendMode: BlendModeValue): BlendModeField {
  return {
    $type: 'enum',
    value: blendMode,
    enumType: 'BlendMode',
  };
}

function buildXiexeToonMaterialFields(
  blendMode: BlendModeValue = 'Cutout'
): XiexeToonMaterialFields {
  return {
    BlendMode: createBlendModeField(blendMode),
    ShadowRamp: { $type: 'reference', targetId: null },
    ShadowSharpness: { $type: 'float', value: 0 },
  };
}

function buildStaticTexture2DFields(textureValue: string): StaticTexture2DFields {
  const fields: StaticTexture2DFields = {
    URL: { $type: 'Uri', value: textureValue },
    WrapModeU: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
    WrapModeV: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
  };

  if (isGifTexture(textureValue)) {
    fields.FilterMode = {
      $type: 'enum?',
      value: 'Point',
      enumType: 'TextureFilterMode',
    };
  }

  return fields;
}

function isGifTexture(textureValue: string): boolean {
  if (textureValue.startsWith(TEXTURE_REFERENCE_PREFIX)) {
    return false;
  }
  if (textureValue.startsWith(TEXTURE_PLACEHOLDER_PREFIX)) {
    return GIF_EXTENSION_PATTERN.test(textureValue.slice(TEXTURE_PLACEHOLDER_PREFIX.length));
  }
  return GIF_EXTENSION_PATTERN.test(textureValue);
}

function parseTextureReferenceId(textureValue?: string): string | undefined {
  if (!textureValue || !textureValue.startsWith(TEXTURE_REFERENCE_PREFIX)) {
    return undefined;
  }
  return textureValue.slice(TEXTURE_REFERENCE_PREFIX.length);
}

function toSharedTexturePropertyBlockId(textureComponentId: string): string {
  if (textureComponentId.endsWith(SHARED_TEXTURE_COMPONENT_SUFFIX)) {
    return (
      textureComponentId.slice(0, -SHARED_TEXTURE_COMPONENT_SUFFIX.length) +
      SHARED_TEXTURE_PROPERTY_BLOCK_SUFFIX
    );
  }
  return `${textureComponentId}${SHARED_TEXTURE_PROPERTY_BLOCK_SUFFIX}`;
}

export function buildQuadMeshComponents(
  slotId: string,
  textureValue?: string,
  dualSided: boolean = false,
  size: QuadSize = { x: 1, y: 1 },
  blendMode: BlendModeValue = 'Cutout'
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
    fields: buildXiexeToonMaterialFields(blendMode),
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

export function buildBoxColliderComponent(slotId: string, size: BoxSize): ResoniteComponent {
  return {
    id: `${slotId}-collider`,
    type: '[FrooxEngine]FrooxEngine.BoxCollider',
    fields: {
      Size: { $type: 'float3', value: size },
    },
  };
}

export function buildGrabbableComponent(slotId: string): ResoniteComponent {
  return {
    id: `${slotId}-grabbable`,
    type: '[FrooxEngine]FrooxEngine.Grabbable',
    fields: {
      Scalable: { $type: 'bool', value: true },
    },
  };
}

export function toTexturePlaceholder(identifier: string): string {
  return `${TEXTURE_PLACEHOLDER_PREFIX}${identifier}`;
}

export function toTextureReference(componentId: string): string {
  return `${TEXTURE_REFERENCE_PREFIX}${componentId}`;
}

export function resolveTextureValue(
  identifier?: string,
  textureMap?: Map<string, string>
): string | undefined {
  if (!identifier) {
    return undefined;
  }
  if (textureMap) {
    return textureMap.get(identifier) ?? identifier;
  }
  return toTexturePlaceholder(identifier);
}

export function replaceTexturesInValue(value: unknown, textureMap: Map<string, string>): unknown {
  if (typeof value === 'string') {
    if (!value.startsWith(TEXTURE_PLACEHOLDER_PREFIX)) {
      return value;
    }
    const identifier = value.slice(TEXTURE_PLACEHOLDER_PREFIX.length);
    return textureMap.get(identifier) ?? identifier;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceTexturesInValue(item, textureMap));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const recordValue = value as Record<string, unknown>;
  const replaced: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(recordValue)) {
    replaced[key] = replaceTexturesInValue(item, textureMap);
  }
  return replaced;
}
