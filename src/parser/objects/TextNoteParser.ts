/**
 * Parser for Udonarium TextNote objects
 */

import { TextNote } from '../../domain/UdonariumObject';
import { findDataByName, getTextValue, getNumberValue, parsePosition } from './ParserUtils';

export function parseTextNote(data: unknown, fileName: string): TextNote {
  const root = data as Record<string, unknown>;
  const noteData = findDataByName(root.data, 'text-note');

  // Parse common data
  const commonData = findDataByName(noteData, 'common');
  const name = getTextValue(findDataByName(commonData, 'title')) || fileName;

  // Parse text content
  const text = getTextValue(findDataByName(noteData, 'note')) || '';
  const fontSize = getNumberValue(findDataByName(noteData, 'fontSize')) ?? 14;

  // Parse position
  const position = parsePosition(root);

  return {
    id: (root['@_identifier'] as string) || fileName,
    type: 'text-note',
    name,
    position,
    text,
    fontSize,
    images: [],
    properties: new Map(),
  };
}
