/**
 * Parser for Udonarium TextNote objects
 */

import { TextNote } from '../../converter/UdonariumObject';
import { findDataByName, getTextValue, getNumberValue } from './ParserUtils';

export function parseTextNote(data: unknown, fileName: string): TextNote {
  const root = data as Record<string, unknown>;
  const noteData = findDataByName(root.data, 'text-note');

  // Parse common data
  const commonData = findDataByName(noteData, 'common');
  const name = getTextValue(findDataByName(commonData, 'title')) || fileName;

  // Parse text content
  const text = getTextValue(findDataByName(noteData, 'note')) || '';
  const fontSize = getNumberValue(findDataByName(noteData, 'fontSize')) || 14;

  // Parse position
  const posX = getNumberValue(root['@_posX']) || 0;
  const posY = getNumberValue(root['@_posY']) || 0;
  const posZ = getNumberValue(root['@_posZ']) || 0;

  return {
    id: (root['@_identifier'] as string) || fileName,
    type: 'text-note',
    name,
    position: { x: posX, y: posY, z: posZ },
    text,
    fontSize,
    images: [],
    properties: new Map(),
  };
}
