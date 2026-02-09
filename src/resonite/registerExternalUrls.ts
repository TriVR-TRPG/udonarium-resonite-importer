import { UdonariumObject } from '../converter/UdonariumObject';
import { AssetImporter } from './AssetImporter';
import { KNOWN_IMAGE_IDENTIFIERS } from '../config/MappingConfig';

const UDONARIUM_BASE_URL = 'https://udonarium.app/';

function tryRegister(identifier: string, assetImporter: AssetImporter): void {
  if (identifier.startsWith('./')) {
    const url = UDONARIUM_BASE_URL + identifier.slice(2);
    assetImporter.registerExternalUrl(identifier, url);
  } else if (KNOWN_IMAGE_IDENTIFIERS.has(identifier)) {
    assetImporter.registerExternalUrl(identifier, KNOWN_IMAGE_IDENTIFIERS.get(identifier)!);
  }
}

/**
 * Find image identifiers that are relative paths (e.g., ./assets/images/tex.jpg)
 * or known Udonarium built-in identifiers, and register them as external URLs
 * in the AssetImporter.
 */
export function registerExternalUrls(
  objects: UdonariumObject[],
  assetImporter: AssetImporter
): void {
  for (const obj of objects) {
    for (const img of obj.images) {
      tryRegister(img.identifier, assetImporter);
    }
    if (obj.type === 'terrain') {
      if (obj.wallImage) tryRegister(obj.wallImage.identifier, assetImporter);
      if (obj.floorImage) tryRegister(obj.floorImage.identifier, assetImporter);
    }
    if (obj.type === 'card') {
      if (obj.frontImage) tryRegister(obj.frontImage.identifier, assetImporter);
      if (obj.backImage) tryRegister(obj.backImage.identifier, assetImporter);
    }
    if (obj.type === 'card-stack') {
      for (const card of obj.cards) {
        if (card.frontImage) tryRegister(card.frontImage.identifier, assetImporter);
        if (card.backImage) tryRegister(card.backImage.identifier, assetImporter);
      }
    }
  }
}
