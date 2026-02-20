/**
 * Tests for CharacterParser
 */

import { describe, it, expect } from 'vitest';
import { parseCharacter } from './CharacterParser';

describe('CharacterParser', () => {
  describe('parseCharacter', () => {
    it('should parse basic character with name and size', () => {
      const data = {
        '@_identifier': 'char-001',
        '@_location.name': 'graveyard',
        '@_rotate': '30',
        '@_roll': '60',
        data: [
          {
            '@_name': 'character',
            data: [
              {
                '@_name': 'common',
                data: [
                  { '@_name': 'name', '#text': 'Hero' },
                  { '@_name': 'size', '#text': '2' },
                ],
              },
            ],
          },
        ],
      };

      const result = parseCharacter(data, 'test.xml');

      expect(result.id).toBe('char-001');
      expect(result.type).toBe('character');
      expect(result.name).toBe('Hero');
      expect(result.size).toBe(2);
      expect(result.locationName).toBe('graveyard');
      expect(result.rotate).toBe(30);
      expect(result.roll).toBe(60);
    });

    it('should use fileName as fallback for name', () => {
      const data = {
        data: [
          {
            '@_name': 'character',
            data: [{ '@_name': 'common', data: [] }],
          },
        ],
      };

      const result = parseCharacter(data, 'fallback.xml');

      expect(result.name).toBe('fallback.xml');
    });

    it('should use fileName as fallback for id', () => {
      const data = {
        data: [
          {
            '@_name': 'character',
            data: [],
          },
        ],
      };

      const result = parseCharacter(data, 'test-id.xml');

      expect(result.id).toBe('test-id.xml');
    });

    it('should parse image identifier', () => {
      const data = {
        '@_identifier': 'char-002',
        data: [
          {
            '@_name': 'character',
            data: [
              {
                '@_name': 'image',
                data: [{ '@_name': 'imageIdentifier', '#text': 'img-abc123' }],
              },
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'Test' }],
              },
            ],
          },
        ],
      };

      const result = parseCharacter(data, 'test.xml');

      expect(result.images).toHaveLength(1);
      expect(result.images[0].identifier).toBe('img-abc123');
      expect(result.images[0].name).toBe('main');
    });

    it('should parse position from location.x/location.y attributes', () => {
      const data = {
        '@_identifier': 'char-003',
        '@_location.x': '100',
        '@_location.y': '200',
        '@_posZ': '25',
        data: [
          {
            '@_name': 'character',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'Test' }],
              },
            ],
          },
        ],
      };

      const result = parseCharacter(data, 'test.xml');

      expect(result.position.x).toBe(100);
      expect(result.position.y).toBe(200);
      expect(result.position.z).toBe(25);
    });

    it('should parse position from location.x/location.y with posZ', () => {
      const data = {
        '@_identifier': 'char-004',
        '@_location.x': '50',
        '@_location.y': '75',
        '@_posZ': '10',
        data: [
          {
            '@_name': 'character',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'Test' }],
              },
            ],
          },
        ],
      };

      const result = parseCharacter(data, 'test.xml');

      expect(result.position.x).toBe(50);
      expect(result.position.y).toBe(75);
      expect(result.position.z).toBe(10);
    });

    it('should default position to (0, 0)', () => {
      const data = {
        data: [
          {
            '@_name': 'character',
            data: [],
          },
        ],
      };

      const result = parseCharacter(data, 'test.xml');

      expect(result.position.x).toBe(0);
      expect(result.position.y).toBe(0);
      expect(result.position.z).toBe(0);
    });

    it('should default size to 1', () => {
      const data = {
        data: [
          {
            '@_name': 'character',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'Test' }],
              },
            ],
          },
        ],
      };

      const result = parseCharacter(data, 'test.xml');

      expect(result.size).toBe(1);
    });

    it('should handle empty data gracefully', () => {
      const data = {};

      const result = parseCharacter(data, 'empty.xml');

      expect(result.id).toBe('empty.xml');
      expect(result.name).toBe('empty.xml');
      expect(result.size).toBe(1);
      expect(result.images).toHaveLength(0);
    });
  });
});
