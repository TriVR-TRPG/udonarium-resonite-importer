/**
 * Parser for Udonarium GameTable and TableMask objects
 */

import { GameTable, TableMask, ImageRef } from '../../converter/UdonariumObject';
import {
  findDataByName,
  getTextValue,
  getNumberValue,
  getBooleanValue,
  parsePosition,
} from './ParserUtils';

/**
 * Parse game-table element with attributes (used in room save data)
 */
export function parseGameTable(data: unknown, fileName: string): GameTable {
  const root = data as Record<string, unknown>;

  // game-table has attributes directly on the element
  const name = (root['@_name'] as string) || fileName;
  const width = getNumberValue(root['@_width']) || 20;
  const height = getNumberValue(root['@_height']) || 15;
  const gridType = (root['@_gridType'] as string) || 'SQUARE';
  const gridColor = (root['@_gridColor'] as string) || '#000000';
  const imageIdentifier = root['@_imageIdentifier'] as string;

  const images: ImageRef[] = [];
  if (imageIdentifier) {
    images.push({
      identifier: imageIdentifier,
      name: 'surface',
    });
  }

  return {
    id: (root['@_identifier'] as string) || fileName,
    type: 'table',
    name,
    position: { x: 0, y: 0, z: 0 },
    width,
    height,
    gridType,
    gridColor,
    images,
    properties: new Map(),
    children: [],
  };
}

export function parseTable(data: unknown, fileName: string): GameTable {
  const root = data as Record<string, unknown>;
  const tableData = findDataByName(root.data, 'table');

  // Parse image
  const imageData = findDataByName(tableData, 'image');
  const imageIdentifier = getTextValue(findDataByName(imageData, 'imageIdentifier'));

  const images: ImageRef[] = [];
  if (imageIdentifier) {
    images.push({
      identifier: imageIdentifier,
      name: 'surface',
    });
  }

  // Parse common data
  const commonData = findDataByName(tableData, 'common');
  const name = getTextValue(findDataByName(commonData, 'name')) || fileName;
  const width = getNumberValue(findDataByName(commonData, 'width')) || 20;
  const height = getNumberValue(findDataByName(commonData, 'height')) || 20;
  const gridType = getTextValue(findDataByName(commonData, 'gridType')) || 'SQUARE';
  const gridColor = getTextValue(findDataByName(commonData, 'gridColor')) || '#000000';

  return {
    id: (root['@_identifier'] as string) || fileName,
    type: 'table',
    name,
    position: { x: 0, y: 0, z: 0 },
    width,
    height,
    gridType,
    gridColor,
    images,
    properties: new Map(),
    children: [],
  };
}

export function parseTableMask(data: unknown, fileName: string): TableMask {
  const root = data as Record<string, unknown>;
  const maskData = findDataByName(root.data, 'table-mask');
  const imageData = findDataByName(maskData, 'image');
  const imageIdentifier = getTextValue(findDataByName(imageData, 'imageIdentifier'));

  // Parse common data
  const commonData = findDataByName(maskData, 'common');
  const name = getTextValue(findDataByName(commonData, 'name')) || fileName;
  const width = getNumberValue(findDataByName(commonData, 'width')) ?? 4;
  const height = getNumberValue(findDataByName(commonData, 'height')) ?? 4;
  const opacityNode = findDataByName(commonData, 'opacity') as Record<string, unknown> | undefined;
  const opacity = getNumberValue(opacityNode?.['@_currentValue']) ?? getNumberValue(opacityNode);

  // Parse position and attributes
  const position = parsePosition(root);
  const isLock = getBooleanValue(root['@_isLock']) ?? false;
  const properties = new Map<string, string | number>();
  if (opacity !== undefined) {
    properties.set('opacity', opacity);
  }
  const images: ImageRef[] = [];
  if (imageIdentifier) {
    images.push({
      identifier: imageIdentifier,
      name: 'mask',
    });
  }

  return {
    id: (root['@_identifier'] as string) || fileName,
    type: 'table-mask',
    name,
    position,
    isLock,
    width,
    height,
    images,
    properties,
  };
}
