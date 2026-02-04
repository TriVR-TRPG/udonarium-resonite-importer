/**
 * Integration tests using sample Udonarium save data
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { extractZip } from './ZipExtractor';
import { parseXml, parseXmlFiles } from './XmlParser';

// Use process.cwd() since Vitest runs from project root
const SAMPLE_ZIP_PATH = path.join(process.cwd(), 'src', '__fixtures__', 'roomdata-sample.zip');

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
      expect(characters.length).toBeGreaterThanOrEqual(4); // At least 4 characters in sample

      // Verify character names
      const names = characters.map((c) => c.name);
      expect(names).toContain('モンスターA');
      expect(names).toContain('モンスターB');
      expect(names).toContain('モンスターC');
    });

    it('should parse terrain objects from game-table', () => {
      const extracted = extractZip(SAMPLE_ZIP_PATH);
      const dataFile = extracted.xmlFiles.find((f) => f.name === 'data');
      const content = dataFile!.data.toString('utf-8');

      const result = parseXml(content, 'data.xml');

      // Should find terrain objects inside <game-table>
      const terrains = result.objects.filter((o) => o.type === 'terrain');
      expect(terrains.length).toBeGreaterThanOrEqual(3); // At least 3 terrains in sample

      // Verify terrain has dimensions
      if (terrains.length > 0) {
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
      expect(cardStacks.length).toBeGreaterThanOrEqual(2); // At least 2 card stacks

      // Verify card stack has name
      const stackNames = cardStacks.map((s) => s.name);
      expect(stackNames).toContain('山札');
    });

    it('should parse standalone card objects', () => {
      const extracted = extractZip(SAMPLE_ZIP_PATH);
      const dataFile = extracted.xmlFiles.find((f) => f.name === 'data');
      const content = dataFile!.data.toString('utf-8');

      const result = parseXml(content, 'data.xml');

      // Should find standalone card objects (not inside card-stack)
      const cards = result.objects.filter((o) => o.type === 'card');
      expect(cards.length).toBeGreaterThanOrEqual(3); // At least 3 standalone cards
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
        expect(table.name).toBe('最初のテーブル');
      }
    });

    it('should parse all expected object types from sample', () => {
      const extracted = extractZip(SAMPLE_ZIP_PATH);
      const dataFile = extracted.xmlFiles.find((f) => f.name === 'data');
      const content = dataFile!.data.toString('utf-8');

      const result = parseXml(content, 'data.xml');

      // Get unique types
      const types = [...new Set(result.objects.map((o) => o.type))];

      // Sample data should have these types
      expect(types).toContain('character');
      expect(types).toContain('terrain');
      expect(types).toContain('card');
      expect(types).toContain('card-stack');
      expect(types).toContain('table');

      // Total count should be reasonable
      expect(result.objects.length).toBeGreaterThanOrEqual(10);
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

      // Should find objects from data.xml
      expect(result.objects.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('character parsing details', () => {
    it('should parse character resources (HP/MP)', () => {
      const extracted = extractZip(SAMPLE_ZIP_PATH);
      const dataFile = extracted.xmlFiles.find((f) => f.name === 'data');
      const content = dataFile!.data.toString('utf-8');

      const result = parseXml(content, 'data.xml');
      const characters = result.objects.filter((o) => o.type === 'character');

      // Find a character with resources
      const charWithResources = characters.find(
        (c) => 'resources' in c && (c as { resources: unknown[] }).resources.length > 0
      );

      expect(charWithResources).toBeDefined();

      if (charWithResources && 'resources' in charWithResources) {
        const resources = charWithResources.resources as Array<{
          name: string;
          currentValue: number;
          maxValue: number;
        }>;
        expect(resources.length).toBeGreaterThanOrEqual(2);

        // Should have HP and MP
        const resourceNames = resources.map((r) => r.name);
        expect(resourceNames).toContain('HP');
        expect(resourceNames).toContain('MP');
      }
    });

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
