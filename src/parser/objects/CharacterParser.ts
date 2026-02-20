/**
 * Parser for Udonarium GameCharacter objects
 */

import { GameCharacter, ImageRef } from '../../domain/UdonariumObject';
import { findDataByName, getTextValue, getNumberValue, parsePosition } from './ParserUtils';

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
  const size = getNumberValue(findDataByName(commonData, 'size')) ?? 1;
  const rotate = getNumberValue(root['@_rotate']) ?? 0;
  const roll = getNumberValue(root['@_roll']) ?? 0;

  // Parse position (if available)
  const position = parsePosition(root);
  const locationName = typeof root['@_location.name'] === 'string' ? root['@_location.name'] : '';

  return {
    id: (root['@_identifier'] as string) || fileName,
    type: 'character',
    name,
    position,
    locationName,
    size,
    rotate,
    roll,
    images,
  };
}
