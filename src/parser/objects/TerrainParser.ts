/**
 * Parser for Udonarium Terrain objects
 */

import { Terrain, ImageRef } from '../../converter/UdonariumObject';
import { findDataByName, getTextValue, getNumberValue, parsePosition } from './ParserUtils';

export function parseTerrain(data: unknown, fileName: string): Terrain {
  const root = data as Record<string, unknown>;
  const terrainData = findDataByName(root.data, 'terrain');

  // Parse images
  const imageData = findDataByName(terrainData, 'image');
  let wallImage: ImageRef | null = null;
  let floorImage: ImageRef | null = null;

  const wallIdentifier = getTextValue(findDataByName(imageData, 'wall'));
  if (wallIdentifier) {
    wallImage = { identifier: wallIdentifier, name: 'wall' };
  }

  const floorIdentifier = getTextValue(findDataByName(imageData, 'floor'));
  if (floorIdentifier) {
    floorImage = { identifier: floorIdentifier, name: 'floor' };
  }

  // Parse common data
  const commonData = findDataByName(terrainData, 'common');
  const name = getTextValue(findDataByName(commonData, 'name')) || fileName;
  const width = getNumberValue(findDataByName(commonData, 'width')) || 1;
  const height = getNumberValue(findDataByName(commonData, 'height')) || 1;
  const depth = getNumberValue(findDataByName(commonData, 'depth')) || 1;

  // Parse position
  const position = parsePosition(root);

  const images: ImageRef[] = [];
  if (wallImage) images.push(wallImage);
  if (floorImage) images.push(floorImage);

  return {
    id: (root['@_identifier'] as string) || fileName,
    type: 'terrain',
    name,
    position,
    width,
    height,
    depth,
    images,
    properties: new Map(),
    wallImage,
    floorImage,
  };
}
