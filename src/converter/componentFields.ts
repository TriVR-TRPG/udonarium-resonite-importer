/**
 * Field builders for FrooxEngine components.
 * Single source of truth for component field structure shared between
 * ResoniteObjectBuilder (game-object assembly) and SlotBuilder (asset-library slots).
 */

export function buildStaticTexture2DFields(
  url: string,
  usePointFilter: boolean
): Record<string, unknown> {
  return {
    URL: { $type: 'Uri', value: url },
    WrapModeU: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
    WrapModeV: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
    ...(usePointFilter
      ? { FilterMode: { $type: 'enum?', value: 'Point', enumType: 'TextureFilterMode' } }
      : {}),
  };
}

export function buildMainTexturePropertyBlockFields(textureId: string): Record<string, unknown> {
  return {
    Texture: { $type: 'reference', targetId: textureId },
  };
}
