import sharp from 'sharp';
import { ExtractedFile } from '../parser/ZipExtractor';
import { UdonariumObject } from '../domain/UdonariumObject';
import {
  KNOWN_EXTERNAL_IMAGE_ASPECT_RATIOS,
  KNOWN_EXTERNAL_IMAGE_ASPECT_RATIO_PREFIXES,
  KNOWN_IMAGES,
} from '../config/MappingConfig';

function normalizeIdentifier(identifier: string): string {
  return identifier.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function extractPathFromAbsoluteUrl(identifier: string): string | undefined {
  if (!identifier.startsWith('http://') && !identifier.startsWith('https://')) {
    return undefined;
  }
  try {
    const url = new URL(identifier);
    return normalizeIdentifier(url.pathname.replace(/^\/+/, ''));
  } catch {
    return undefined;
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
  return undefined;
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
    return undefined;
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

  return undefined;
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
    if (knownRatio) {
      setRatioForIdentifier(map, identifier, knownRatio);
    }
  }

  return map;
}
