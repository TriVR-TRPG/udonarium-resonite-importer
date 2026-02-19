import { UdonariumObject } from '../domain/UdonariumObject';
import { AssetImporter } from './AssetImporter';
import { KNOWN_IMAGES } from '../config/MappingConfig';

const UDONARIUM_BASE_URL = 'https://udonarium.app/';
const SVG_URL_PATTERN = /\.svg$/i;

async function tryRegister(identifier: string, assetImporter: AssetImporter): Promise<void> {
  if (identifier.startsWith('./')) {
    const url = UDONARIUM_BASE_URL + identifier.slice(2);
    assetImporter.registerExternalUrl(identifier, url);
  } else if (KNOWN_IMAGES.has(identifier)) {
    assetImporter.registerExternalUrl(identifier, KNOWN_IMAGES.get(identifier)!.url);
  } else if (identifier.startsWith('http://') || identifier.startsWith('https://')) {
    if (SVG_URL_PATTERN.test(identifier.split('?')[0])) {
      await assetImporter.importExternalSvgUrl(identifier, identifier);
    } else {
      assetImporter.registerExternalUrl(identifier, identifier);
    }
  }
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
