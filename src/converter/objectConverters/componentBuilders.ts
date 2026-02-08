import { ResoniteComponent } from '../ResoniteObject';

const TEXTURE_PLACEHOLDER_PREFIX = 'texture://';

export function buildQuadMeshComponents(
  slotId: string,
  textureValue?: string,
  dualSided: boolean = false
): ResoniteComponent[] {
  const meshId = `${slotId}-mesh`;
  const materialId = `${slotId}-mat`;
  const textureId = `${slotId}-tex`;
  const components: ResoniteComponent[] = [
    {
      id: meshId,
      type: '[FrooxEngine]FrooxEngine.QuadMesh',
      fields: dualSided ? { DualSided: { $type: 'bool', value: true } } : {},
    },
  ];

  if (textureValue) {
    components.push({
      id: textureId,
      type: '[FrooxEngine]FrooxEngine.StaticTexture2D',
      fields: {
        URL: { $type: 'Uri', value: textureValue },
      },
    });
  }

  components.push({
    id: materialId,
    type: '[FrooxEngine]FrooxEngine.UnlitMaterial',
    fields: textureValue
      ? {
          Texture: { $type: 'reference', targetId: textureId },
        }
      : {},
  });
  components.push({
    id: `${slotId}-renderer`,
    type: '[FrooxEngine]FrooxEngine.MeshRenderer',
    fields: {
      Mesh: { $type: 'reference', targetId: meshId },
      Materials: {
        $type: 'list',
        elements: [{ $type: 'reference', targetId: materialId }],
      },
    },
  });

  return components;
}

export function buildBoxMeshComponents(slotId: string, textureValue?: string): ResoniteComponent[] {
  const meshId = `${slotId}-mesh`;
  const materialId = `${slotId}-mat`;
  const textureId = `${slotId}-tex`;
  const components: ResoniteComponent[] = [
    {
      id: meshId,
      type: '[FrooxEngine]FrooxEngine.BoxMesh',
      fields: {},
    },
  ];

  if (textureValue) {
    components.push({
      id: textureId,
      type: '[FrooxEngine]FrooxEngine.StaticTexture2D',
      fields: {
        URL: { $type: 'Uri', value: textureValue },
      },
    });
  }

  components.push({
    id: materialId,
    type: '[FrooxEngine]FrooxEngine.PBS_Metallic',
    fields: textureValue
      ? {
          AlbedoTexture: { $type: 'reference', targetId: textureId },
        }
      : {},
  });
  components.push({
    id: `${slotId}-renderer`,
    type: '[FrooxEngine]FrooxEngine.MeshRenderer',
    fields: {
      Mesh: { $type: 'reference', targetId: meshId },
      Materials: {
        $type: 'list',
        elements: [{ $type: 'reference', targetId: materialId }],
      },
    },
  });

  return components;
}

export function toTexturePlaceholder(identifier: string): string {
  return `${TEXTURE_PLACEHOLDER_PREFIX}${identifier}`;
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
