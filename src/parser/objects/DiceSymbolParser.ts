/**
 * Parser for Udonarium DiceSymbol objects
 */

import { DiceSymbol, ImageRef } from '../../domain/UdonariumObject';
import { findDataByName, getNumberValue, getTextValue, parsePosition } from './ParserUtils';

type DataNode = {
  '@_name'?: string;
  '@_type'?: string;
  '#text'?: string | number;
  data?: DataNode | DataNode[];
};

function getImageEntries(imageData: unknown): DataNode[] {
  if (!imageData || typeof imageData !== 'object') {
    return [];
  }
  const entries = (imageData as DataNode).data;
  if (Array.isArray(entries)) {
    return entries;
  }
  return entries ? [entries] : [];
}

export function parseDiceSymbol(data: unknown, fileName: string): DiceSymbol {
  const root = data as Record<string, unknown>;
  const diceData = findDataByName(root.data, 'dice-symbol');

  const commonData = findDataByName(diceData, 'common');
  const imageData = findDataByName(diceData, 'image');
  const face = root['@_face'] as string;

  const name = getTextValue(findDataByName(commonData, 'name')) || fileName;
  const size = getNumberValue(findDataByName(commonData, 'size')) ?? 1;
  const rotate = getNumberValue(root['@_rotate']) ?? 0;

  const faceImages: ImageRef[] = getImageEntries(imageData)
    .filter((entry) => entry && typeof entry === 'object' && entry['@_type'] === 'image')
    .map((entry) => {
      const identifier = getTextValue(entry);
      if (!identifier) {
        return null;
      }
      return {
        identifier,
        name: entry['@_name'] || 'face',
      };
    })
    .filter((entry): entry is ImageRef => entry !== null);

  const currentFaceImage = faceImages.find((image) => image.name === face) ?? faceImages[0] ?? null;
  const images = currentFaceImage
    ? [currentFaceImage, ...faceImages.filter((image) => image !== currentFaceImage)]
    : [];

  return {
    id: (root['@_identifier'] as string) || fileName,
    type: 'dice-symbol',
    name,
    position: parsePosition(root),
    images,
    faceImages,
    size,
    face,
    rotate,
  };
}
