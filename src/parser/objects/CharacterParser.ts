/**
 * Parser for Udonarium GameCharacter objects
 */

import { GameCharacter, ImageRef, NumberResource } from '../../converter/UdonariumObject';
import { findDataByName, getTextValue, getNumberValue } from './ParserUtils';

export function parseCharacter(data: unknown, fileName: string): GameCharacter {
  const root = data as Record<string, unknown>;
  const characterData = findDataByName(root.data, 'character');

  // Parse image
  const imageData = findDataByName(characterData, 'image');
  const imageIdentifier = getTextValue(findDataByName(imageData, 'imageIdentifier'));

  const images: ImageRef[] = [];
  if (imageIdentifier) {
    images.push({
      identifier: imageIdentifier,
      name: 'main',
    });
  }

  // Parse common data
  const commonData = findDataByName(characterData, 'common');
  const name = getTextValue(findDataByName(commonData, 'name')) || fileName;
  const size = getNumberValue(findDataByName(commonData, 'size')) || 1;

  // Parse resources
  const resources: NumberResource[] = [];
  const detailData = findDataByName(characterData, 'detail');
  if (detailData) {
    parseResourcesFromDetail(detailData, resources);
  }

  // Parse position (if available)
  // Udonarium uses location.x/location.y OR posX/posY for 2D position, and posZ for Z axis.
  const posX = getNumberValue(root['@_location.x']) || getNumberValue(root['@_posX']) || 0;
  const posY = getNumberValue(root['@_location.y']) || getNumberValue(root['@_posY']) || 0;
  const posZ = getNumberValue(root['@_posZ']) || 0;

  return {
    id: (root['@_identifier'] as string) || fileName,
    type: 'character',
    name,
    position: { x: posX, y: posY, z: posZ },
    size,
    images,
    properties: new Map(),
    resources,
  };
}

function parseResourcesFromDetail(detailData: unknown, resources: NumberResource[]): void {
  if (!detailData || typeof detailData !== 'object') return;

  const dataArray = (detailData as Record<string, unknown>).data;
  if (!Array.isArray(dataArray)) return;

  for (const item of dataArray) {
    if (
      item &&
      typeof item === 'object' &&
      (item as Record<string, unknown>)['@_type'] === 'numberResource'
    ) {
      const name = ((item as Record<string, unknown>)['@_name'] as string) || '';
      const maxValue = getNumberValue((item as Record<string, unknown>)['#text']) || 0;
      const currentValue =
        getNumberValue((item as Record<string, unknown>)['@_currentValue']) || maxValue;

      resources.push({ name, currentValue, maxValue });
    }

    // Recursively search nested data
    if ((item as Record<string, unknown>).data) {
      parseResourcesFromDetail(item, resources);
    }
  }
}
