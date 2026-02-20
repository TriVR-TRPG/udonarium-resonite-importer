import { UdonariumObject } from '../domain/UdonariumObject';
import { AssetImporter } from './AssetImporter';
import { KNOWN_IMAGES } from '../config/MappingConfig';
import { ImageSourceKind } from '../converter/imageAssetContext';

const UDONARIUM_BASE_URL = 'https://udonarium.app/';
const SVG_URL_PATTERN = /\.svg$/i;

export type ExternalImageSource = {
  identifier: string;
  url: string;
  sourceKind: ImageSourceKind;
};

function resolveExternalImageSource(identifier: string): ExternalImageSource | undefined {
  if (identifier.startsWith('./')) {
    const url = UDONARIUM_BASE_URL + identifier.slice(2);
    return { identifier, url, sourceKind: 'udonarium-asset-url' };
  }

  if (KNOWN_IMAGES.has(identifier)) {
    return {
      identifier,
      url: KNOWN_IMAGES.get(identifier)!.url,
      sourceKind: 'known-id',
    };
  }

  if (identifier.startsWith('http://') || identifier.startsWith('https://')) {
    return {
      identifier,
      url: identifier,
      sourceKind: SVG_URL_PATTERN.test(identifier.split('?')[0]) ? 'external-svg' : 'external-url',
    };
  }

  return undefined;
}

function appendObjectImageIdentifiers(object: UdonariumObject, identifiers: Set<string>): void {
  for (const image of object.images) {
    identifiers.add(image.identifier);
  }
  if (object.type === 'terrain') {
    if (object.wallImage) identifiers.add(object.wallImage.identifier);
    if (object.floorImage) identifiers.add(object.floorImage.identifier);
  }
  if (object.type === 'card') {
    if (object.frontImage) identifiers.add(object.frontImage.identifier);
    if (object.backImage) identifiers.add(object.backImage.identifier);
  }
  if (object.type === 'card-stack') {
    for (const card of object.cards) {
      if (card.frontImage) identifiers.add(card.frontImage.identifier);
      if (card.backImage) identifiers.add(card.backImage.identifier);
    }
  }
}

export function collectExternalImageSources(
  objects: UdonariumObject[]
): Map<string, ExternalImageSource> {
  const identifiers = new Set<string>();

  for (const object of objects) {
    appendObjectImageIdentifiers(object, identifiers);
    if (object.type === 'table' && object.children.length > 0) {
      for (const childIdentifier of collectExternalImageSources(object.children).keys()) {
        identifiers.add(childIdentifier);
      }
    }
  }

  const sources = new Map<string, ExternalImageSource>();
  for (const identifier of identifiers) {
    const source = resolveExternalImageSource(identifier);
    if (source) {
      sources.set(identifier, source);
    }
  }
  return sources;
}

async function tryRegister(identifier: string, assetImporter: AssetImporter): Promise<void> {
  const source = resolveExternalImageSource(identifier);
  if (!source) {
    return;
  }
  if (source.sourceKind === 'external-svg') {
    await assetImporter.importExternalSvgUrl(source.identifier, source.url);
    return;
  }
  assetImporter.registerExternalUrl(source.identifier, source.url, source.sourceKind);
}

/**
 * Find image identifiers that are relative paths (e.g., ./assets/images/tex.jpg)
 * or known Udonarium built-in identifiers, and register them as external URLs
 * in the AssetImporter. External SVG URLs are downloaded and converted to PNG.
 */
export async function registerExternalUrls(
  objects: UdonariumObject[],
  assetImporter: AssetImporter
): Promise<void> {
  for (const obj of objects) {
    for (const img of obj.images) {
      await tryRegister(img.identifier, assetImporter);
    }
    if (obj.type === 'terrain') {
      if (obj.wallImage) await tryRegister(obj.wallImage.identifier, assetImporter);
      if (obj.floorImage) await tryRegister(obj.floorImage.identifier, assetImporter);
    }
    if (obj.type === 'card') {
      if (obj.frontImage) await tryRegister(obj.frontImage.identifier, assetImporter);
      if (obj.backImage) await tryRegister(obj.backImage.identifier, assetImporter);
    }
    if (obj.type === 'card-stack') {
      for (const card of obj.cards) {
        if (card.frontImage) await tryRegister(card.frontImage.identifier, assetImporter);
        if (card.backImage) await tryRegister(card.backImage.identifier, assetImporter);
      }
    }
    if (obj.type === 'table' && obj.children.length > 0) {
      await registerExternalUrls(obj.children, assetImporter);
    }
  }
}
