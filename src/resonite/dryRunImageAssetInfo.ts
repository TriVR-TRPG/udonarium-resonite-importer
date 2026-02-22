import * as path from 'path';
import { UdonariumObject } from '../domain/UdonariumObject';
import { ExtractedFile } from '../parser/ZipExtractor';
import { ImageAssetInfo, ImageFilterMode, ImageSourceKind } from '../converter/imageAssetContext';
import { isGifTexture } from '../converter/textureUtils';
import { collectExternalImageSources } from './registerExternalUrls';

function resolveZipImageSourceKind(image: ExtractedFile): ImageSourceKind {
  const extension = path.extname(image.path || image.name).toLowerCase();
  return extension === '.svg' ? 'zip-svg' : 'zip-image';
}

function resolveFilterMode(identifier: string, textureValue: string): ImageFilterMode {
  return isGifTexture(identifier) || isGifTexture(textureValue) ? 'Point' : 'Default';
}

export function buildDryRunImageAssetInfoMap(
  imageFiles: ExtractedFile[],
  objects: UdonariumObject[]
): Map<string, ImageAssetInfo> {
  const imageAssetInfoMap = new Map<string, ImageAssetInfo>();

  for (const imageFile of imageFiles) {
    imageAssetInfoMap.set(imageFile.name, {
      identifier: imageFile.name,
      textureValue: imageFile.name,
      sourceKind: resolveZipImageSourceKind(imageFile),
      filterMode: resolveFilterMode(imageFile.name, imageFile.name),
    });
  }

  for (const source of collectExternalImageSources(objects).values()) {
    imageAssetInfoMap.set(source.identifier, {
      identifier: source.identifier,
      textureValue: source.url,
      sourceKind: source.sourceKind,
      filterMode: resolveFilterMode(source.identifier, source.url),
    });
  }

  return imageAssetInfoMap;
}
