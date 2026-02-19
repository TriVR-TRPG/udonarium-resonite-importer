const TEXTURE_REFERENCE_PREFIX = 'texture-ref://';
const GIF_EXTENSION_PATTERN = /\.gif(?:$|[?#])/i;
const SHARED_TEXTURE_COMPONENT_SUFFIX = '-static-texture';
const SHARED_TEXTURE_PROPERTY_BLOCK_SUFFIX = '-main-texture-property-block';

export type BlendModeValue = 'Cutout' | 'Opaque' | 'Alpha';
export type ColorXValue = { r: number; g: number; b: number; a: number; profile: string };

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
  return identifier;
}

export function isGifTexture(identifier: string, textureMap?: Map<string, string>): boolean {
  if (identifier.startsWith(TEXTURE_REFERENCE_PREFIX)) {
    return false;
  }
  if (textureMap) {
    const resolvedUrl = textureMap.get(identifier) ?? identifier;
    return GIF_EXTENSION_PATTERN.test(identifier) || GIF_EXTENSION_PATTERN.test(resolvedUrl);
  }
  return GIF_EXTENSION_PATTERN.test(identifier);
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
