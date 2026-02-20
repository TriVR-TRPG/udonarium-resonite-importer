import * as path from 'path';
import { UdonariumObject } from '../domain/UdonariumObject';
import { ExtractedFile } from '../parser/ZipExtractor';
import { ImageAssetInfo } from '../converter/imageAssetContext';
import { collectExternalImageSources } from './registerExternalUrls';

function resolveZipImageSourceKind(image: ExtractedFile): ImageAssetInfo['sourceKind'] {
  const extension = path.extname(image.path || image.name).toLowerCase();
  return extension === '.svg' ? 'zip-svg' : 'zip-image';
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
    });
  }

  for (const source of collectExternalImageSources(objects).values()) {
    imageAssetInfoMap.set(source.identifier, {
      identifier: source.identifier,
      textureValue: source.url,
      sourceKind: source.sourceKind,
    });
  }

  return imageAssetInfoMap;
}
