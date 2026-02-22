import sharp from 'sharp';
import { ExtractedFile } from '../parser/ZipExtractor';
import { UdonariumObject } from '../domain/UdonariumObject';
import {
  KNOWN_EXTERNAL_IMAGE_BLEND_MODES,
  KNOWN_EXTERNAL_IMAGE_BLEND_MODE_PREFIXES,
  KNOWN_EXTERNAL_IMAGE_ASPECT_RATIOS,
  KNOWN_EXTERNAL_IMAGE_ASPECT_RATIO_PREFIXES,
  ImageBlendMode,
  KNOWN_IMAGES,
} from '../config/MappingConfig';

export interface BlendModeMapOptions {
  semiTransparentMode?: 'Cutout' | 'Alpha';
}

function normalizeIdentifier(identifier: string): string {
  return identifier.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function extractPathFromAbsoluteUrl(identifier: string): string | undefined {
  if (!identifier.startsWith('http://') && !identifier.startsWith('https://')) {
    return;
  }
  try {
    const url = new URL(identifier);
    return normalizeIdentifier(url.pathname.replace(/^\/+/, ''));
  } catch {
    return;
  }
}

function buildImageKeys(file: ExtractedFile): string[] {
  const normalizedPath = normalizeIdentifier(file.path);
  return buildIdentifierKeys(file.name, normalizedPath);
}

function buildIdentifierKeys(identifier: string, normalizedIdentifier?: string): string[] {
  const normalized = normalizedIdentifier ?? normalizeIdentifier(identifier);
  const keys = new Set<string>([identifier, normalized, `./${normalized}`]);
  const pathSegments = normalized.split('/');
  const fileNameWithExt = pathSegments[pathSegments.length - 1];
  if (fileNameWithExt) {
    keys.add(fileNameWithExt);
    const basenameWithoutExt = fileNameWithExt.replace(/\.[^.]+$/, '');
    if (basenameWithoutExt) {
      keys.add(basenameWithoutExt);
    }
  }
  const urlPath = extractPathFromAbsoluteUrl(identifier);
  if (urlPath) {
    keys.add(urlPath);
    keys.add(`./${urlPath}`);
    const urlSegments = urlPath.split('/');
    const urlBasename = urlSegments[urlSegments.length - 1];
    if (urlBasename) {
      keys.add(urlBasename);
      const urlBasenameWithoutExt = urlBasename.replace(/\.[^.]+$/, '');
      if (urlBasenameWithoutExt) {
        keys.add(urlBasenameWithoutExt);
      }
    }
  }
  return [...keys];
}

function setRatioForIdentifier(
  map: Map<string, number>,
  identifier: string,
  ratio: number,
  normalizedIdentifier?: string
): void {
  for (const key of buildIdentifierKeys(identifier, normalizedIdentifier)) {
    map.set(key, ratio);
  }
}

function resolveKnownRatioForFile(file: ExtractedFile): number | undefined {
  const normalizedPath = normalizeIdentifier(file.path);
  const candidates = [file.name, file.path, normalizedPath, `./${normalizedPath}`];
  for (const candidate of candidates) {
    const ratio = resolveKnownRatio(candidate);
    if (ratio && Number.isFinite(ratio) && ratio > 0) {
      return ratio;
    }
  }
  return;
}

function resolveKnownRatio(identifier: string): number | undefined {
  const normalized = normalizeIdentifier(identifier);
  const knownImage = KNOWN_IMAGES.get(identifier);
  if (knownImage) {
    return knownImage.aspectRatio;
  }
  const knownPathRatio =
    KNOWN_EXTERNAL_IMAGE_ASPECT_RATIOS.get(identifier) ??
    KNOWN_EXTERNAL_IMAGE_ASPECT_RATIOS.get(normalized) ??
    KNOWN_EXTERNAL_IMAGE_ASPECT_RATIOS.get(`./${normalized}`);
  if (knownPathRatio) {
    return knownPathRatio;
  }
  for (const entry of KNOWN_EXTERNAL_IMAGE_ASPECT_RATIO_PREFIXES) {
    if (
      normalized.startsWith(entry.prefix) ||
      normalized.startsWith(`./${entry.prefix}`) ||
      identifier.startsWith(entry.prefix) ||
      identifier.startsWith(`./${entry.prefix}`)
    ) {
      return entry.ratio;
    }
  }
  const urlPath = extractPathFromAbsoluteUrl(identifier);
  if (urlPath) {
    const urlPathRatio = KNOWN_EXTERNAL_IMAGE_ASPECT_RATIOS.get(urlPath);
    if (urlPathRatio) {
      return urlPathRatio;
    }
    for (const entry of KNOWN_EXTERNAL_IMAGE_ASPECT_RATIO_PREFIXES) {
      if (urlPath.startsWith(entry.prefix)) {
        return entry.ratio;
      }
    }
  }
  return;
}

function resolveKnownBlendMode(identifier: string): ImageBlendMode | undefined {
  const normalized = normalizeIdentifier(identifier);
  const knownImage = KNOWN_IMAGES.get(identifier);
  if (knownImage) {
    return knownImage.blendMode;
  }
  const knownPathBlendMode =
    KNOWN_EXTERNAL_IMAGE_BLEND_MODES.get(identifier) ??
    KNOWN_EXTERNAL_IMAGE_BLEND_MODES.get(normalized) ??
    KNOWN_EXTERNAL_IMAGE_BLEND_MODES.get(`./${normalized}`);
  if (knownPathBlendMode) {
    return knownPathBlendMode;
  }
  for (const entry of KNOWN_EXTERNAL_IMAGE_BLEND_MODE_PREFIXES) {
    if (
      normalized.startsWith(entry.prefix) ||
      normalized.startsWith(`./${entry.prefix}`) ||
      identifier.startsWith(entry.prefix) ||
      identifier.startsWith(`./${entry.prefix}`)
    ) {
      return entry.blendMode;
    }
  }
  const urlPath = extractPathFromAbsoluteUrl(identifier);
  if (urlPath) {
    const urlPathBlendMode = KNOWN_EXTERNAL_IMAGE_BLEND_MODES.get(urlPath);
    if (urlPathBlendMode) {
      return urlPathBlendMode;
    }
    for (const entry of KNOWN_EXTERNAL_IMAGE_BLEND_MODE_PREFIXES) {
      if (urlPath.startsWith(entry.prefix)) {
        return entry.blendMode;
      }
    }
  }
  return;
}

function seedKnownAspectRatioMap(map: Map<string, number>): void {
  for (const [identifier, known] of KNOWN_IMAGES) {
    const ratio = known.aspectRatio;
    setRatioForIdentifier(map, identifier, ratio);
    setRatioForIdentifier(map, known.url, ratio);
    const knownUrlPath = extractPathFromAbsoluteUrl(known.url);
    if (knownUrlPath) {
      setRatioForIdentifier(map, knownUrlPath, ratio);
    }
  }
  for (const [identifier, ratio] of KNOWN_EXTERNAL_IMAGE_ASPECT_RATIOS) {
    setRatioForIdentifier(map, identifier, ratio);
  }
}

function seedKnownBlendModeMap(map: Map<string, ImageBlendMode>): void {
  for (const [identifier, known] of KNOWN_IMAGES) {
    const blendMode = known.blendMode;
    setBlendModeForIdentifier(map, identifier, blendMode);
    setBlendModeForIdentifier(map, known.url, blendMode);
    const knownUrlPath = extractPathFromAbsoluteUrl(known.url);
    if (knownUrlPath) {
      setBlendModeForIdentifier(map, knownUrlPath, blendMode);
    }
  }
  for (const [identifier, blendMode] of KNOWN_EXTERNAL_IMAGE_BLEND_MODES) {
    setBlendModeForIdentifier(map, identifier, blendMode);
  }
}

function collectImageIdentifiers(objects: UdonariumObject[]): string[] {
  const identifiers: string[] = [];
  const collectFromObject = (obj: UdonariumObject): void => {
    for (const img of obj.images) {
      identifiers.push(img.identifier);
    }
    if (obj.type === 'terrain') {
      if (obj.wallImage) identifiers.push(obj.wallImage.identifier);
      if (obj.floorImage) identifiers.push(obj.floorImage.identifier);
    }
    if (obj.type === 'card') {
      if (obj.frontImage) identifiers.push(obj.frontImage.identifier);
      if (obj.backImage) identifiers.push(obj.backImage.identifier);
    }
    if (obj.type === 'card-stack') {
      for (const card of obj.cards) {
        if (card.frontImage) identifiers.push(card.frontImage.identifier);
        if (card.backImage) identifiers.push(card.backImage.identifier);
      }
    }
    if (obj.type === 'table') {
      for (const child of obj.children) {
        collectFromObject(child);
      }
    }
  };
  for (const obj of objects) {
    collectFromObject(obj);
  }
  return identifiers;
}

export function lookupImageAspectRatio(
  imageAspectRatioMap: Map<string, number>,
  identifier: string | undefined
): number | undefined {
  if (!identifier) {
    return;
  }

  const normalized = normalizeIdentifier(identifier);
  const candidates = [identifier, normalized, `./${normalized}`];
  const normalizedSegments = normalized.split('/');
  const basenameWithExt = normalizedSegments[normalizedSegments.length - 1];
  if (basenameWithExt) {
    candidates.push(basenameWithExt);
    const basenameWithoutExt = basenameWithExt.replace(/\.[^.]+$/, '');
    if (basenameWithoutExt) {
      candidates.push(basenameWithoutExt);
    }
  }

  for (const key of candidates) {
    const ratio = imageAspectRatioMap.get(key);
    if (ratio && Number.isFinite(ratio) && ratio > 0) {
      return ratio;
    }
  }

  return;
}

function findImageBlendMode(
  imageBlendModeMap: Map<string, ImageBlendMode>,
  identifier: string | undefined
): ImageBlendMode | undefined {
  if (!identifier) {
    return;
  }

  const normalized = normalizeIdentifier(identifier);
  const candidates = [identifier, normalized, `./${normalized}`];
  const normalizedSegments = normalized.split('/');
  const basenameWithExt = normalizedSegments[normalizedSegments.length - 1];
  if (basenameWithExt) {
    candidates.push(basenameWithExt);
    const basenameWithoutExt = basenameWithExt.replace(/\.[^.]+$/, '');
    if (basenameWithoutExt) {
      candidates.push(basenameWithoutExt);
    }
  }

  for (const key of candidates) {
    const blendMode = imageBlendModeMap.get(key);
    if (blendMode) {
      return blendMode;
    }
  }

  return;
}

export function lookupImageBlendMode(
  imageBlendModeMap: Map<string, ImageBlendMode> | undefined,
  identifier: string | undefined
): ImageBlendMode {
  if (!imageBlendModeMap) {
    return 'Cutout';
  }

  return findImageBlendMode(imageBlendModeMap, identifier) ?? 'Cutout';
}

/**
 * Build image aspect ratio map keyed by Udonarium image identifier.
 * ratio = height / width
 */
export async function buildImageAspectRatioMap(
  imageFiles: ExtractedFile[],
  objects: UdonariumObject[] = []
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  seedKnownAspectRatioMap(map);

  await Promise.all(
    imageFiles.map(async (file) => {
      const knownRatio = resolveKnownRatioForFile(file);
      if (knownRatio) {
        // Prefer curated known ratios when available and skip metadata probing.
        const normalizedPath = normalizeIdentifier(file.path);
        setRatioForIdentifier(map, file.name, knownRatio);
        setRatioForIdentifier(map, file.path, knownRatio, normalizedPath);
        return;
      }

      try {
        const metadata = await sharp(file.data).metadata();
        const width = metadata.width;
        const height = metadata.height;
        if (!width || !height || width <= 0 || height <= 0) {
          return;
        }
        const ratio = height / width;
        for (const key of buildImageKeys(file)) {
          map.set(key, ratio);
        }
      } catch {
        // Ignore unsupported/corrupted images and fall back to default card ratio.
      }
    })
  );

  for (const identifier of collectImageIdentifiers(objects)) {
    const knownRatio = resolveKnownRatio(identifier);
    if (knownRatio && !lookupImageAspectRatio(map, identifier)) {
      setRatioForIdentifier(map, identifier, knownRatio);
    }
  }

  return map;
}

function setBlendModeForIdentifier(
  map: Map<string, ImageBlendMode>,
  identifier: string,
  blendMode: ImageBlendMode,
  normalizedIdentifier?: string
): void {
  for (const key of buildIdentifierKeys(identifier, normalizedIdentifier)) {
    map.set(key, blendMode);
  }
}

function resolveKnownBlendModeForFile(file: ExtractedFile): ImageBlendMode | undefined {
  const normalizedPath = normalizeIdentifier(file.path);
  const candidates = [file.name, file.path, normalizedPath, `./${normalizedPath}`];
  for (const candidate of candidates) {
    const blendMode = resolveKnownBlendMode(candidate);
    if (blendMode) {
      return blendMode;
    }
  }
  return;
}

function buildExternalProbeUrl(identifier: string): string | undefined {
  if (identifier.startsWith('http://') || identifier.startsWith('https://')) {
    return identifier;
  }
  const normalized = normalizeIdentifier(identifier);
  if (normalized.startsWith('assets/')) {
    return `https://udonarium.app/${normalized}`;
  }
  return;
}

async function probeBlendModeFromExternalUrl(
  url: string,
  options?: BlendModeMapOptions
): Promise<ImageBlendMode | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return;
    }
    const bytes = await response.arrayBuffer();
    const metadata = await sharp(Buffer.from(bytes)).metadata();
    const hasAlpha = metadata.hasAlpha ?? (metadata.channels ?? 0) >= 4;
    return hasAlpha ? (options?.semiTransparentMode ?? 'Alpha') : 'Opaque';
  } catch {
    return;
  }
}

export async function buildImageBlendModeMap(
  imageFiles: ExtractedFile[],
  objects: UdonariumObject[] = [],
  options?: BlendModeMapOptions
): Promise<Map<string, ImageBlendMode>> {
  const map = new Map<string, ImageBlendMode>();
  seedKnownBlendModeMap(map);

  await Promise.all(
    imageFiles.map(async (file) => {
      const knownBlendMode = resolveKnownBlendModeForFile(file);
      if (knownBlendMode) {
        const normalizedPath = normalizeIdentifier(file.path);
        setBlendModeForIdentifier(map, file.name, knownBlendMode);
        setBlendModeForIdentifier(map, file.path, knownBlendMode, normalizedPath);
        return;
      }

      try {
        const metadata = await sharp(file.data).metadata();
        const hasAlpha = metadata.hasAlpha ?? (metadata.channels ?? 0) >= 4;
        const blendMode: ImageBlendMode = hasAlpha
          ? (options?.semiTransparentMode ?? 'Alpha')
          : 'Opaque';
        const normalizedPath = normalizeIdentifier(file.path);
        setBlendModeForIdentifier(map, file.name, blendMode);
        setBlendModeForIdentifier(map, file.path, blendMode, normalizedPath);
      } catch {
        // Ignore unsupported/corrupted images and keep unresolved blend mode.
      }
    })
  );

  const externalProbeTasks: Array<Promise<void>> = [];
  for (const identifier of collectImageIdentifiers(objects)) {
    const knownBlendMode = resolveKnownBlendMode(identifier);
    if (knownBlendMode && findImageBlendMode(map, identifier) === undefined) {
      setBlendModeForIdentifier(map, identifier, knownBlendMode);
      continue;
    }
    if (findImageBlendMode(map, identifier) !== undefined) {
      continue;
    }
    const probeUrl = buildExternalProbeUrl(identifier);
    if (!probeUrl) {
      continue;
    }
    externalProbeTasks.push(
      (async () => {
        const probed = await probeBlendModeFromExternalUrl(probeUrl, options);
        if (probed) {
          setBlendModeForIdentifier(map, identifier, probed);
          setBlendModeForIdentifier(map, probeUrl, probed);
        }
      })()
    );
  }
  await Promise.all(externalProbeTasks);

  return map;
}
