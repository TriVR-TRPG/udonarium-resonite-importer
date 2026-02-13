/**
 * XML parsing utilities for Udonarium object definitions
 */

import { XMLParser } from 'fast-xml-parser';
import { UdonariumObject, GameTable, GameTableChild } from '../domain/UdonariumObject';
import { SUPPORTED_TAGS } from '../config/MappingConfig';
import { parseCharacter } from './objects/CharacterParser';
import { parseCard, parseCardStack } from './objects/CardParser';
import { parseTerrain } from './objects/TerrainParser';
import { parseTable, parseGameTable, parseTableMask } from './objects/TableParser';
import { parseTextNote } from './objects/TextNoteParser';

/**
 * Container tags whose XML children should not be recursed into.
 * - game-table: children collected into GameTable.children
 * - card-stack: children already handled by parseCardStack internally
 */
const CONTAINER_TAGS: ReadonlySet<string> = new Set(['game-table', 'card-stack']);

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
 * Recursively find all supported objects in a parsed XML structure.
 * Container tags (game-table, card-stack) are not recursed into:
 * - game-table: child objects are collected into GameTable.children
 * - card-stack: child cards are already handled by parseCardStack
 */
function findObjectsRecursively(data: unknown, fileName: string, result: ParseResult): void {
  if (data === null || data === undefined) return;

  if (typeof data !== 'object') return;

  const obj = data as Record<string, unknown>;
  const consumedKeys = new Set<string>();

  // Check if current object has any supported tags
  for (const tag of SUPPORTED_TAGS) {
    if (!(tag in obj) || obj[tag] === undefined) continue;

    const tagData = obj[tag];
    const items = Array.isArray(tagData) ? tagData : [tagData];

    for (const item of items) {
      const parsed = parseObjectByType(tag, item, fileName);
      if (parsed) {
        // game-table: collect child objects into GameTable.children
        if (tag === 'game-table') {
          const childResult: ParseResult = { objects: [], errors: [] };
          findObjectsRecursively(item, fileName, childResult);
          (parsed as GameTable).children = childResult.objects as GameTableChild[];
          result.errors.push(...childResult.errors);
        }
        result.objects.push(parsed);
      }
    }

    // Container tags: skip recursing into their XML children
    if (CONTAINER_TAGS.has(tag)) {
      consumedKeys.add(tag);
    }
  }

  // Recursively search nested structures, skipping consumed container keys
  for (const key of Object.keys(obj)) {
    if (consumedKeys.has(key)) continue;
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
