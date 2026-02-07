import { UdonariumObject } from '../converter/UdonariumObject';
import { AssetImporter } from './AssetImporter';

const UDONARIUM_BASE_URL = 'https://udonarium.app/';

/**
 * Find image identifiers that are relative paths (e.g., ./assets/images/tex.jpg)
 * and register them as external URLs in the AssetImporter.
 */
export function registerExternalUrls(
  objects: UdonariumObject[],
  assetImporter: AssetImporter
): void {
  for (const obj of objects) {
    for (const img of obj.images) {
      if (img.identifier.startsWith('./')) {
        const url = UDONARIUM_BASE_URL + img.identifier.slice(2);
        assetImporter.registerExternalUrl(img.identifier, url);
      }
    }
    if (obj.type === 'terrain') {
      if (obj.wallImage?.identifier.startsWith('./')) {
        const url = UDONARIUM_BASE_URL + obj.wallImage.identifier.slice(2);
        assetImporter.registerExternalUrl(obj.wallImage.identifier, url);
      }
      if (obj.floorImage?.identifier.startsWith('./')) {
        const url = UDONARIUM_BASE_URL + obj.floorImage.identifier.slice(2);
        assetImporter.registerExternalUrl(obj.floorImage.identifier, url);
      }
    }
    if (obj.type === 'card') {
      if (obj.frontImage?.identifier.startsWith('./')) {
        const url = UDONARIUM_BASE_URL + obj.frontImage.identifier.slice(2);
        assetImporter.registerExternalUrl(obj.frontImage.identifier, url);
      }
      if (obj.backImage?.identifier.startsWith('./')) {
        const url = UDONARIUM_BASE_URL + obj.backImage.identifier.slice(2);
        assetImporter.registerExternalUrl(obj.backImage.identifier, url);
      }
    }
    if (obj.type === 'card-stack') {
      for (const card of obj.cards) {
        if (card.frontImage?.identifier.startsWith('./')) {
          const url = UDONARIUM_BASE_URL + card.frontImage.identifier.slice(2);
          assetImporter.registerExternalUrl(card.frontImage.identifier, url);
        }
        if (card.backImage?.identifier.startsWith('./')) {
          const url = UDONARIUM_BASE_URL + card.backImage.identifier.slice(2);
          assetImporter.registerExternalUrl(card.backImage.identifier, url);
        }
      }
    }
  }
}
