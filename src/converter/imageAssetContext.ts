import { ImageBlendMode } from '../config/MappingConfig';
import { lookupImageAspectRatio, lookupImageBlendMode } from './imageAspectRatioMap';
import { isGifTexture } from './textureUtils';

export type ImageFilterMode = 'Default' | 'Point';

export type ImageSourceKind =
  | 'zip-image'
  | 'zip-svg'
  | 'known-id'
  | 'udonarium-asset-url'
  | 'external-url'
  | 'external-svg'
  | 'unknown';

export type ImageAssetInfo = {
  identifier: string;
  textureValue?: string;
  aspectRatio?: number;
  blendMode?: ImageBlendMode;
  filterMode?: ImageFilterMode;
  sourceKind?: ImageSourceKind;
};

export interface ImageAssetContext {
  byIdentifier: ReadonlyMap<string, ImageAssetInfo>;
  getAssetInfo(identifier?: string): ImageAssetInfo | null;
  resolveTextureValue(identifier?: string): string | null;
  lookupAspectRatio(identifier?: string): number | null;
  lookupBlendMode(identifier?: string): ImageBlendMode;
  resolveUsePointFilter(identifier?: string, resolvedTextureValue?: string): boolean;
}

function normalizeIdentifier(identifier: string): string {
  return identifier.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function buildLookupKeys(identifier: string): string[] {
  const normalized = normalizeIdentifier(identifier);
  const keys = [identifier, normalized, `./${normalized}`];
  const segments = normalized.split('/');
  const basenameWithExt = segments[segments.length - 1];
  if (basenameWithExt) {
    keys.push(basenameWithExt);
    const basenameWithoutExt = basenameWithExt.replace(/\.[^.]+$/, '');
    if (basenameWithoutExt) {
      keys.push(basenameWithoutExt);
    }
  }
  return keys;
}

function lookupByKeys<T>(map?: Map<string, T>, identifier?: string): T | null {
  if (!map || !identifier) {
    return null;
  }
  for (const key of buildLookupKeys(identifier)) {
    const value = map.get(key);
    if (value != null) {
      return value;
    }
  }
  return null;
}

function lookupImageFilterMode(
  imageFilterModeMap?: Map<string, ImageFilterMode>,
  identifier?: string
): ImageFilterMode | null {
  return lookupByKeys(imageFilterModeMap, identifier);
}

function buildIdentifierSet(options: BuildImageAssetContextOptions): Set<string> {
  const identifiers = new Set<string>();
  for (const key of options.imageAssetInfoMap?.keys() ?? []) identifiers.add(key);
  for (const key of options.imageAspectRatioMap?.keys() ?? []) {
    identifiers.add(key);
  }
  for (const key of options.imageBlendModeMap?.keys() ?? []) {
    identifiers.add(key);
  }
  for (const key of options.imageFilterModeMap?.keys() ?? []) {
    identifiers.add(key);
  }
  return identifiers;
}

function inferSourceKind(identifier: string, textureValue?: string): ImageSourceKind {
  const normalizedIdentifier = normalizeIdentifier(identifier).toLowerCase();
  const normalizedTextureValue = textureValue?.toLowerCase();

  if (normalizedIdentifier.startsWith('./assets/') || normalizedIdentifier.startsWith('assets/')) {
    return 'udonarium-asset-url';
  }

  if (normalizedIdentifier.startsWith('http://') || normalizedIdentifier.startsWith('https://')) {
    return /\.svg(?:$|\?)/.test(normalizedIdentifier) ? 'external-svg' : 'external-url';
  }

  if (normalizedTextureValue?.startsWith('resdb://')) {
    return normalizedIdentifier.endsWith('.svg') ? 'zip-svg' : 'zip-image';
  }

  if (
    normalizedTextureValue?.startsWith('http://') ||
    normalizedTextureValue?.startsWith('https://')
  ) {
    return 'external-url';
  }

  return 'unknown';
}

export interface BuildImageAssetContextOptions {
  imageAssetInfoMap?: Map<string, ImageAssetInfo>;
  imageAspectRatioMap?: Map<string, number>;
  imageBlendModeMap?: Map<string, ImageBlendMode>;
  imageFilterModeMap?: Map<string, ImageFilterMode>;
}

export function buildImageAssetContext(
  options: BuildImageAssetContextOptions = {}
): ImageAssetContext {
  const byIdentifier = new Map<string, ImageAssetInfo>();

  for (const identifier of buildIdentifierSet(options)) {
    const seed = lookupByKeys(options.imageAssetInfoMap, identifier);
    const textureValue = seed?.textureValue;
    const aspectRatio = options.imageAspectRatioMap
      ? (lookupImageAspectRatio(options.imageAspectRatioMap, identifier) ?? seed?.aspectRatio)
      : seed?.aspectRatio;
    const blendMode = options.imageBlendModeMap
      ? (lookupImageBlendMode(options.imageBlendModeMap, identifier) ?? seed?.blendMode)
      : seed?.blendMode;
    const filterMode =
      lookupImageFilterMode(options.imageFilterModeMap, identifier) ?? seed?.filterMode;
    const sourceKind = seed?.sourceKind ?? inferSourceKind(identifier, textureValue);

    const info: ImageAssetInfo = {
      identifier,
      ...(textureValue != null ? { textureValue } : {}),
      ...(aspectRatio != null ? { aspectRatio } : {}),
      ...(blendMode != null ? { blendMode } : {}),
      ...(filterMode != null ? { filterMode } : {}),
      ...(sourceKind != null ? { sourceKind } : {}),
    };
    byIdentifier.set(identifier, info);
  }

  function getAssetInfo(identifier?: string): ImageAssetInfo | null {
    if (!identifier) {
      return null;
    }
    for (const key of buildLookupKeys(identifier)) {
      const info = byIdentifier.get(key);
      if (info) {
        return info;
      }
    }
    return null;
  }

  return {
    byIdentifier,
    getAssetInfo,
    resolveTextureValue(identifier?: string): string | null {
      const info = getAssetInfo(identifier);
      return info?.textureValue ?? null;
    },
    lookupAspectRatio(identifier?: string): number | null {
      const info = getAssetInfo(identifier);
      if (info?.aspectRatio != null) {
        return info.aspectRatio;
      }
      if (!options.imageAspectRatioMap) {
        return null;
      }
      return lookupImageAspectRatio(options.imageAspectRatioMap, identifier);
    },
    lookupBlendMode(identifier?: string): ImageBlendMode {
      const info = getAssetInfo(identifier);
      if (info?.blendMode) {
        return info.blendMode;
      }
      return lookupImageBlendMode(options.imageBlendModeMap, identifier);
    },
    resolveUsePointFilter(identifier?: string, resolvedTextureValue?: string): boolean {
      const info = getAssetInfo(identifier);
      if (info?.filterMode) {
        return info.filterMode === 'Point';
      }
      if (resolvedTextureValue) {
        return isGifTexture(resolvedTextureValue);
      }
      return false;
    },
  };
}
