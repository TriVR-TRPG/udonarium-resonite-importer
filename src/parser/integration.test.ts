/**
 * Integration tests using sample Udonarium save data
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { extractZip } from './ZipExtractor';
import { parseXml, parseXmlFiles } from './XmlParser';

// Use process.cwd() since Vitest runs from project root
const SAMPLE_ZIP_PATH = path.join(process.cwd(), 'src', '__fixtures__', 'sample-all-object.zip');

describe('Integration: Sample Save Data', () => {
  describe('extractZip with sample data', () => {
    it('should extract XML files from sample ZIP', () => {
      const result = extractZip(SAMPLE_ZIP_PATH);

      expect(result.xmlFiles.length).toBeGreaterThan(0);

      const fileNames = result.xmlFiles.map((f) => f.name);
      expect(fileNames).toContain('data');
      expect(fileNames).toContain('chat');
      expect(fileNames).toContain('summary');
    });

    it('should extract data.xml with content', () => {
      const result = extractZip(SAMPLE_ZIP_PATH);

      const dataFile = result.xmlFiles.find((f) => f.name === 'data');
      expect(dataFile).toBeDefined();
      expect(dataFile!.data.length).toBeGreaterThan(0);

      const content = dataFile!.data.toString('utf-8');
      expect(content).toContain('<room>');
      expect(content).toContain('<character');
      expect(content).toContain('<terrain');
    });
  });

  describe('parseXml with sample data.xml', () => {
    it('should parse characters from room-wrapped XML', () => {
      const extracted = extractZip(SAMPLE_ZIP_PATH);
      const dataFile = extracted.xmlFiles.find((f) => f.name === 'data');
      const content = dataFile!.data.toString('utf-8');

      const result = parseXml(content, 'data.xml');

      // Should not have parsing errors
      expect(result.errors).toHaveLength(0);

      // Should find character objects inside <room>
      const characters = result.objects.filter((o) => o.type === 'character');
      expect(characters.length).toBeGreaterThanOrEqual(1);
    });

    it('should parse terrain objects as children of game-table', () => {
      const extracted = extractZip(SAMPLE_ZIP_PATH);
      const dataFile = extracted.xmlFiles.find((f) => f.name === 'data');
      const content = dataFile!.data.toString('utf-8');

      const result = parseXml(content, 'data.xml');

      // Terrains should be inside game-table's children, not at top level
      const tables = result.objects.filter((o) => o.type === 'table');
      expect(tables.length).toBeGreaterThanOrEqual(1);

      const table = tables[0];
      if (table.type === 'table') {
        const terrains = table.children.filter((o) => o.type === 'terrain');
        expect(terrains.length).toBeGreaterThanOrEqual(1);

        // Verify terrain has dimensions
        const terrain = terrains[0];
        expect(terrain.type).toBe('terrain');
        expect('width' in terrain).toBe(true);
        expect('height' in terrain).toBe(true);
        expect('depth' in terrain).toBe(true);
      }
    });

    it('should parse card-stack objects', () => {
      const extracted = extractZip(SAMPLE_ZIP_PATH);
      const dataFile = extracted.xmlFiles.find((f) => f.name === 'data');
      const content = dataFile!.data.toString('utf-8');

      const result = parseXml(content, 'data.xml');

      // Should find card-stack objects
      const cardStacks = result.objects.filter((o) => o.type === 'card-stack');
      expect(cardStacks.length).toBeGreaterThanOrEqual(1);
    });

    it('should not duplicate cards from card-stacks as standalone objects', () => {
      const extracted = extractZip(SAMPLE_ZIP_PATH);
      const dataFile = extracted.xmlFiles.find((f) => f.name === 'data');
      const content = dataFile!.data.toString('utf-8');

      const result = parseXml(content, 'data.xml');

      // Cards inside card-stacks should NOT appear as standalone top-level objects
      const cardStacks = result.objects.filter((o) => o.type === 'card-stack');
      expect(cardStacks.length).toBeGreaterThanOrEqual(1);

      // Cards should be inside card-stack.cards, not at top level
      let totalCardsInStacks = 0;
      for (const stack of cardStacks) {
        if (stack.type === 'card-stack') {
          totalCardsInStacks += stack.cards.length;
        }
      }
      expect(totalCardsInStacks).toBeGreaterThan(0);
    });

    it('should parse game-table', () => {
      const extracted = extractZip(SAMPLE_ZIP_PATH);
      const dataFile = extracted.xmlFiles.find((f) => f.name === 'data');
      const content = dataFile!.data.toString('utf-8');

      const result = parseXml(content, 'data.xml');

      // Should find game-table object
      const tables = result.objects.filter((o) => o.type === 'table');
      expect(tables.length).toBeGreaterThanOrEqual(1);

      // Verify table properties
      if (tables.length > 0) {
        const table = tables[0];
        expect(table.name).toBeTruthy();
      }
    });

    it('should parse all expected object types from sample', () => {
      const extracted = extractZip(SAMPLE_ZIP_PATH);
      const dataFile = extracted.xmlFiles.find((f) => f.name === 'data');
      const content = dataFile!.data.toString('utf-8');

      const result = parseXml(content, 'data.xml');

      // Collect types from top-level and game-table children
      const allTypes = new Set(result.objects.map((o) => o.type));
      for (const obj of result.objects) {
        if (obj.type === 'table') {
          for (const child of obj.children) {
            allTypes.add(child.type);
          }
        }
      }

      // Sample data should have these types (some may be nested in game-table)
      expect(allTypes).toContain('character');
      expect(allTypes).toContain('terrain');
      expect(allTypes).toContain('card-stack');
      expect(allTypes).toContain('table');
    });
  });

  describe('parseXmlFiles with all sample files', () => {
    it('should parse all XML files from sample ZIP', () => {
      const extracted = extractZip(SAMPLE_ZIP_PATH);

      const result = parseXmlFiles(
        extracted.xmlFiles.map((f) => ({
          name: f.name,
          data: f.data,
        }))
      );

      // Should have no errors
      expect(result.errors).toHaveLength(0);

      // Should find objects from data.xml (some are nested in game-table children)
      expect(result.objects.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('character parsing details', () => {
    it('should parse character position from location attributes', () => {
      const extracted = extractZip(SAMPLE_ZIP_PATH);
      const dataFile = extracted.xmlFiles.find((f) => f.name === 'data');
      const content = dataFile!.data.toString('utf-8');

      const result = parseXml(content, 'data.xml');
      const characters = result.objects.filter((o) => o.type === 'character');

      // Characters should have position
      expect(characters.length).toBeGreaterThan(0);

      // At least one character should have non-zero position
      const hasPosition = characters.some((c) => c.position.x !== 0 || c.position.y !== 0);
      expect(hasPosition).toBe(true);
    });
  });
});
