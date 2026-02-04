/**
 * XML parsing utilities for Udonarium object definitions
 */

import { XMLParser } from 'fast-xml-parser';
import { UdonariumObject } from '../converter/UdonariumObject';
import { SUPPORTED_TAGS } from '../config/MappingConfig';
import { parseCharacter } from './objects/CharacterParser';
import { parseCard, parseCardStack } from './objects/CardParser';
import { parseTerrain } from './objects/TerrainParser';
import { parseTable, parseGameTable, parseTableMask } from './objects/TableParser';
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
 * Recursively find all supported objects in a parsed XML structure
 */
function findObjectsRecursively(data: unknown, fileName: string, result: ParseResult): void {
  if (data === null || data === undefined) return;

  if (typeof data !== 'object') return;

  const obj = data as Record<string, unknown>;

  // Check if current object has any supported tags
  for (const tag of SUPPORTED_TAGS) {
    if (tag in obj && obj[tag] !== undefined) {
      const tagData = obj[tag];
      // Handle arrays of objects (multiple elements with same tag)
      if (Array.isArray(tagData)) {
        for (const item of tagData) {
          const parsed = parseObjectByType(tag, item, fileName);
          if (parsed) {
            result.objects.push(parsed);
          }
        }
      } else {
        const parsed = parseObjectByType(tag, tagData, fileName);
        if (parsed) {
          result.objects.push(parsed);
        }
      }
    }
  }

  // Recursively search nested structures (room, game-table, etc.)
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        for (const item of value) {
          findObjectsRecursively(item, fileName, result);
        }
      } else {
        findObjectsRecursively(value, fileName, result);
      }
    }
  }
}

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

    // Recursively search for supported objects in the entire structure
    findObjectsRecursively(parsed, fileName, result);
  } catch (error) {
    result.errors.push({
      file: fileName,
      message: error instanceof Error ? error.message : 'Unknown parse error',
    });
  }

  return result;
}

type SupportedTag = (typeof SUPPORTED_TAGS)[number];

/**
 * Parse object based on its type tag
 */
function parseObjectByType(
  type: SupportedTag,
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
      case 'game-table':
        return parseGameTable(data, fileName);
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
