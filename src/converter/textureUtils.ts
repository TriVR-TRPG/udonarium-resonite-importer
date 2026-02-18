const TEXTURE_PLACEHOLDER_PREFIX = 'texture://';
const TEXTURE_REFERENCE_PREFIX = 'texture-ref://';
const GIF_EXTENSION_PATTERN = /\.gif(?:$|[?#])/i;
const SHARED_TEXTURE_COMPONENT_SUFFIX = '-static-texture';
const SHARED_TEXTURE_PROPERTY_BLOCK_SUFFIX = '-main-texture-property-block';

export type BlendModeValue = 'Cutout' | 'Opaque' | 'Alpha';
export type ColorXValue = { r: number; g: number; b: number; a: number; profile: string };

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

export function isGifTexture(textureValue: string): boolean {
  if (textureValue.startsWith(TEXTURE_REFERENCE_PREFIX)) {
    return false;
  }
  if (textureValue.startsWith(TEXTURE_PLACEHOLDER_PREFIX)) {
    return GIF_EXTENSION_PATTERN.test(textureValue.slice(TEXTURE_PLACEHOLDER_PREFIX.length));
  }
  return GIF_EXTENSION_PATTERN.test(textureValue);
}

export function parseTextureReferenceId(textureValue?: string): string | undefined {
  if (!textureValue || !textureValue.startsWith(TEXTURE_REFERENCE_PREFIX)) {
    return undefined;
  }
  return textureValue.slice(TEXTURE_REFERENCE_PREFIX.length);
}

export function toSharedTexturePropertyBlockId(textureComponentId: string): string {
  if (textureComponentId.endsWith(SHARED_TEXTURE_COMPONENT_SUFFIX)) {
    return (
      textureComponentId.slice(0, -SHARED_TEXTURE_COMPONENT_SUFFIX.length) +
      SHARED_TEXTURE_PROPERTY_BLOCK_SUFFIX
    );
  }
  return `${textureComponentId}${SHARED_TEXTURE_PROPERTY_BLOCK_SUFFIX}`;
}
