/**
 * Parser for Udonarium GameTable and TableMask objects
 */

import { GameTable, TableMask, ImageRef } from '../../converter/UdonariumObject';
import { findDataByName, getTextValue, getNumberValue } from './ParserUtils';

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
    position: { x: 0, y: 0 },
    width,
    height,
    gridType,
    gridColor,
    images,
    properties: new Map(),
  };
}

export function parseTableMask(data: unknown, fileName: string): TableMask {
  const root = data as Record<string, unknown>;
  const maskData = findDataByName(root.data, 'table-mask');

  // Parse common data
  const commonData = findDataByName(maskData, 'common');
  const name = getTextValue(findDataByName(commonData, 'name')) || fileName;
  const width = getNumberValue(findDataByName(commonData, 'width')) || 4;
  const height = getNumberValue(findDataByName(commonData, 'height')) || 4;

  // Parse position
  const posX = getNumberValue(root['@_posX']) || 0;
  const posY = getNumberValue(root['@_posY']) || 0;

  return {
    id: (root['@_identifier'] as string) || fileName,
    type: 'table-mask',
    name,
    position: { x: posX, y: posY },
    width,
    height,
    images: [],
    properties: new Map(),
  };
}
