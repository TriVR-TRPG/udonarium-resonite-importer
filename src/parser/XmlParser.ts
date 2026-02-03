/**
 * XML parsing utilities for Udonarium object definitions
 */

import { XMLParser } from 'fast-xml-parser';
import { UdonariumObject, ObjectType } from '../converter/UdonariumObject';
import { SUPPORTED_TAGS } from '../config/MappingConfig';
import { parseCharacter } from './objects/CharacterParser';
import { parseCard, parseCardStack } from './objects/CardParser';
import { parseTerrain } from './objects/TerrainParser';
import { parseTable, parseTableMask } from './objects/TableParser';
import { parseTextNote } from './objects/TextNoteParser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => {
    // Data elements can appear multiple times
    return name === 'data';
  },
});

export interface ParseResult {
  objects: UdonariumObject[];
  errors: ParseError[];
}

export interface ParseError {
  file: string;
  message: string;
}

type ParsedXml = Record<string, unknown>;

/**
 * Parse XML content and extract Udonarium objects
 */
export function parseXml(xmlContent: string, fileName: string): ParseResult {
  const result: ParseResult = {
    objects: [],
    errors: [],
  };

  try {
    const parsed: ParsedXml = parser.parse(xmlContent) as ParsedXml;

    for (const tag of SUPPORTED_TAGS) {
      if (tag in parsed && parsed[tag] !== undefined) {
        const obj = parseObjectByType(tag, parsed[tag], fileName);
        if (obj) {
          result.objects.push(obj);
        }
      }
    }
  } catch (error) {
    result.errors.push({
      file: fileName,
      message: error instanceof Error ? error.message : 'Unknown parse error',
    });
  }

  return result;
}

/**
 * Parse object based on its type tag
 */
function parseObjectByType(
  type: ObjectType,
  data: unknown,
  fileName: string
): UdonariumObject | null {
  try {
    switch (type) {
      case 'character':
        return parseCharacter(data, fileName);
      case 'card':
        return parseCard(data, fileName);
      case 'card-stack':
        return parseCardStack(data, fileName);
      case 'terrain':
        return parseTerrain(data, fileName);
      case 'table':
        return parseTable(data, fileName);
      case 'table-mask':
        return parseTableMask(data, fileName);
      case 'text-note':
        return parseTextNote(data, fileName);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Parse multiple XML files
 */
export function parseXmlFiles(files: { name: string; data: Buffer }[]): ParseResult {
  const result: ParseResult = {
    objects: [],
    errors: [],
  };

  for (const file of files) {
    const xmlContent = file.data.toString('utf-8');
    const parsed = parseXml(xmlContent, file.name);
    result.objects.push(...parsed.objects);
    result.errors.push(...parsed.errors);
  }

  return result;
}
