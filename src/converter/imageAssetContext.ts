import { ImageBlendMode } from '../config/MappingConfig';
import { lookupImageAspectRatio, lookupImageBlendMode } from './imageAspectRatioMap';
import {
  isGifTexture,
  resolveTextureValue as resolveTextureValueFromMap,
  toTextureReference,
} from './textureUtils';

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

export interface ImageAssetContextOptions {
  textureMap?: Map<string, string>;
  textureReferenceComponentMap?: Map<string, string>;
  imageAssetInfoMap?: Map<string, ImageAssetInfo>;
  imageAspectRatioMap?: Map<string, number>;
  imageBlendModeMap?: Map<string, ImageBlendMode>;
  imageFilterModeMap?: Map<string, ImageFilterMode>;
  imageSourceKindMap?: Map<string, ImageSourceKind>;
}

export interface ImageAssetContext {
  byIdentifier: Map<string, ImageAssetInfo>;
  getAssetInfo(identifier?: string): ImageAssetInfo | undefined;
  resolveTextureValue(identifier?: string): string | undefined;
  lookupAspectRatio(identifier?: string): number | undefined;
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

function lookupByKeys<T>(
  map: Map<string, T> | undefined,
  identifier: string | undefined
): T | undefined {
  if (!map || !identifier) {
    return undefined;
  }
  for (const key of buildLookupKeys(identifier)) {
    const value = map.get(key);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function lookupImageFilterMode(
  imageFilterModeMap: Map<string, ImageFilterMode> | undefined,
  identifier: string | undefined
): ImageFilterMode | undefined {
  return lookupByKeys(imageFilterModeMap, identifier);
}

function resolveTextureReferenceValue(
  textureReferenceComponentMap: Map<string, string> | undefined,
  identifier: string
): string | undefined {
  const componentId = lookupByKeys(textureReferenceComponentMap, identifier);
  return componentId ? toTextureReference(componentId) : undefined;
}

function buildIdentifierSet(options: ImageAssetContextOptions): Set<string> {
  const identifiers = new Set<string>();
  for (const key of options.textureMap?.keys() ?? []) {
    identifiers.add(key);
  }
  for (const key of options.textureReferenceComponentMap?.keys() ?? []) {
    identifiers.add(key);
  }
  for (const key of options.imageAssetInfoMap?.keys() ?? []) {
    identifiers.add(key);
  }
  for (const key of options.imageAspectRatioMap?.keys() ?? []) {
    identifiers.add(key);
  }
  for (const key of options.imageBlendModeMap?.keys() ?? []) {
    identifiers.add(key);
  }
  for (const key of options.imageFilterModeMap?.keys() ?? []) {
    identifiers.add(key);
  }
  for (const key of options.imageSourceKindMap?.keys() ?? []) {
    identifiers.add(key);
  }
  return identifiers;
}

function inferSourceKind(identifier: string, textureValue: string | undefined): ImageSourceKind {
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
    const isPathLike = normalizedIdentifier.includes('/') || normalizedIdentifier.includes('.');
    return isPathLike ? 'external-url' : 'known-id';
  }

  return 'unknown';
}

export function buildImageFilterModeMap(
  textureMap: Map<string, string>
): Map<string, ImageFilterMode> {
  const map = new Map<string, ImageFilterMode>();
  for (const [identifier] of textureMap) {
    const usePoint = isGifTexture(identifier, textureMap);
    const mode: ImageFilterMode = usePoint ? 'Point' : 'Default';
    for (const key of buildLookupKeys(identifier)) {
      map.set(key, mode);
    }
  }
  return map;
}

export interface BuildImageAssetContextOptions {
  /** @deprecated Prefer imageAssetInfoMap. */
  textureValueMap?: Map<string, string>;
  /** @deprecated Prefer updating imageAssetInfoMap via AssetImporter.applyTextureReferences. */
  textureReferenceComponentMap?: Map<string, string>;
  imageAssetInfoMap?: Map<string, ImageAssetInfo>;
  /** @deprecated Prefer supplying precomputed filterMode in imageAssetInfoMap when possible. */
  filterModeSourceTextureMap?: Map<string, string>;
  imageAspectRatioMap?: Map<string, number>;
  imageBlendModeMap?: Map<string, ImageBlendMode>;
  imageFilterModeMap?: Map<string, ImageFilterMode>;
  /** @deprecated Prefer sourceKind set in imageAssetInfoMap. */
  imageSourceKindMap?: Map<string, ImageSourceKind>;
}

export function buildImageAssetContext(
  options: BuildImageAssetContextOptions = {}
): ImageAssetContext {
  const resolvedImageFilterModeMap =
    options.imageFilterModeMap ??
    (options.filterModeSourceTextureMap
      ? buildImageFilterModeMap(options.filterModeSourceTextureMap)
      : undefined);

  return createImageAssetContext({
    textureMap: options.textureValueMap,
    textureReferenceComponentMap: options.textureReferenceComponentMap,
    imageAssetInfoMap: options.imageAssetInfoMap,
    imageAspectRatioMap: options.imageAspectRatioMap,
    imageBlendModeMap: options.imageBlendModeMap,
    imageFilterModeMap: resolvedImageFilterModeMap,
    imageSourceKindMap: options.imageSourceKindMap,
  });
}

export function createImageAssetContext(options: ImageAssetContextOptions = {}): ImageAssetContext {
  const byIdentifier = new Map<string, ImageAssetInfo>();

  for (const identifier of buildIdentifierSet(options)) {
    const seed = lookupByKeys(options.imageAssetInfoMap, identifier);
    const textureValueFromRef = resolveTextureReferenceValue(
      options.textureReferenceComponentMap,
      identifier
    );
    const textureValueFromMap = options.textureMap
      ? resolveTextureValueFromMap(identifier, options.textureMap)
      : undefined;
    const textureValue = textureValueFromRef ?? textureValueFromMap ?? seed?.textureValue;

    byIdentifier.set(identifier, {
      identifier,
      textureValue,
      aspectRatio:
        (options.imageAspectRatioMap
          ? lookupImageAspectRatio(options.imageAspectRatioMap, identifier)
          : undefined) ?? seed?.aspectRatio,
      blendMode:
        (options.imageBlendModeMap
          ? lookupImageBlendMode(options.imageBlendModeMap, identifier)
          : undefined) ?? seed?.blendMode,
      filterMode: lookupImageFilterMode(options.imageFilterModeMap, identifier) ?? seed?.filterMode,
      sourceKind:
        lookupByKeys(options.imageSourceKindMap, identifier) ??
        seed?.sourceKind ??
        inferSourceKind(identifier, textureValue),
    });
  }

  function getAssetInfo(identifier?: string): ImageAssetInfo | undefined {
    if (!identifier) {
      return undefined;
    }
    for (const key of buildLookupKeys(identifier)) {
      const info = byIdentifier.get(key);
      if (info) {
        return info;
      }
    }
    return undefined;
  }

  return {
    byIdentifier,
    getAssetInfo,
    resolveTextureValue(identifier?: string): string | undefined {
      const info = getAssetInfo(identifier);
      if (info?.textureValue) {
        return info.textureValue;
      }
      return resolveTextureValueFromMap(identifier, options.textureMap);
    },
    lookupAspectRatio(identifier?: string): number | undefined {
      const info = getAssetInfo(identifier);
      if (info?.aspectRatio !== undefined) {
        return info.aspectRatio;
      }
      if (!options.imageAspectRatioMap) {
        return undefined;
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
      if (identifier) {
        return isGifTexture(identifier, options.textureMap);
      }
      if (resolvedTextureValue) {
        return isGifTexture(resolvedTextureValue);
      }
      return false;
    },
  };
}
