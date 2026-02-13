/**
 * Tests for TableParser
 */

import { describe, it, expect } from 'vitest';
import { parseTable, parseGameTable, parseTableMask } from './TableParser';

describe('TableParser', () => {
  describe('parseTable', () => {
    it('should parse basic table with name and dimensions', () => {
      const data = {
        '@_identifier': 'table-001',
        data: [
          {
            '@_name': 'table',
            data: [
              {
                '@_name': 'common',
                data: [
                  { '@_name': 'name', '#text': 'Main Table' },
                  { '@_name': 'width', '#text': '30' },
                  { '@_name': 'height', '#text': '20' },
                  { '@_name': 'gridType', '#text': 'HEX_H' },
                  { '@_name': 'gridColor', '#text': '#FF0000' },
                ],
              },
            ],
          },
        ],
      };

      const result = parseTable(data, 'test.xml');

      expect(result.id).toBe('table-001');
      expect(result.type).toBe('table');
      expect(result.name).toBe('Main Table');
      expect(result.width).toBe(30);
      expect(result.height).toBe(20);
      expect(result.gridType).toBe('HEX_H');
      expect(result.gridColor).toBe('#FF0000');
    });

    it('should use fileName as fallback for name and id', () => {
      const data = {
        data: [
          {
            '@_name': 'table',
            data: [],
          },
        ],
      };

      const result = parseTable(data, 'fallback-table.xml');

      expect(result.id).toBe('fallback-table.xml');
      expect(result.name).toBe('fallback-table.xml');
    });

    it('should use default values for dimensions and grid', () => {
      const data = {
        data: [
          {
            '@_name': 'table',
            data: [],
          },
        ],
      };

      const result = parseTable(data, 'test.xml');

      expect(result.width).toBe(20);
      expect(result.height).toBe(20);
      expect(result.gridType).toBe('SQUARE');
      expect(result.gridColor).toBe('#000000');
    });

    it('should parse image identifier', () => {
      const data = {
        '@_identifier': 'table-002',
        data: [
          {
            '@_name': 'table',
            data: [
              {
                '@_name': 'image',
                data: [{ '@_name': 'imageIdentifier', '#text': 'table-bg-001' }],
              },
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'Test' }],
              },
            ],
          },
        ],
      };

      const result = parseTable(data, 'test.xml');

      expect(result.images).toHaveLength(1);
      expect(result.images[0].identifier).toBe('table-bg-001');
      expect(result.images[0].name).toBe('surface');
    });

    it('should set position to (0, 0)', () => {
      const data = {
        data: [
          {
            '@_name': 'table',
            data: [],
          },
        ],
      };

      const result = parseTable(data, 'test.xml');

      expect(result.position.x).toBe(0);
      expect(result.position.y).toBe(0);
      expect(result.position.z).toBe(0);
    });
  });

  describe('parseGameTable', () => {
    it('should parse game-table with attributes', () => {
      const data = {
        '@_identifier': 'game-table-001',
        '@_name': 'Battle Map',
        '@_width': '25',
        '@_height': '18',
        '@_gridType': 'HEX_V',
        '@_gridColor': '#00FF00',
        '@_imageIdentifier': 'map-texture-001',
      };

      const result = parseGameTable(data, 'test.xml');

      expect(result.id).toBe('game-table-001');
      expect(result.type).toBe('table');
      expect(result.name).toBe('Battle Map');
      expect(result.width).toBe(25);
      expect(result.height).toBe(18);
      expect(result.gridType).toBe('HEX_V');
      expect(result.gridColor).toBe('#00FF00');
    });

    it('should use fileName as fallback for name and id', () => {
      const data = {};

      const result = parseGameTable(data, 'fallback-game-table.xml');

      expect(result.id).toBe('fallback-game-table.xml');
      expect(result.name).toBe('fallback-game-table.xml');
    });

    it('should use default values', () => {
      const data = {};

      const result = parseGameTable(data, 'test.xml');

      expect(result.width).toBe(20);
      expect(result.height).toBe(15);
      expect(result.gridType).toBe('SQUARE');
      expect(result.gridColor).toBe('#000000');
    });

    it('should parse image identifier from attribute', () => {
      const data = {
        '@_imageIdentifier': 'game-table-bg-001',
      };

      const result = parseGameTable(data, 'test.xml');

      expect(result.images).toHaveLength(1);
      expect(result.images[0].identifier).toBe('game-table-bg-001');
      expect(result.images[0].name).toBe('surface');
    });

    it('should handle missing image identifier', () => {
      const data = {
        '@_name': 'No Image Table',
      };

      const result = parseGameTable(data, 'test.xml');

      expect(result.images).toHaveLength(0);
    });

    it('should set position to (0, 0)', () => {
      const data = {};

      const result = parseGameTable(data, 'test.xml');

      expect(result.position.x).toBe(0);
      expect(result.position.y).toBe(0);
      expect(result.position.z).toBe(0);
    });
  });

  describe('parseTableMask', () => {
    it('should parse basic table mask with name and dimensions', () => {
      const data = {
        '@_identifier': 'mask-001',
        data: [
          {
            '@_name': 'table-mask',
            data: [
              {
                '@_name': 'common',
                data: [
                  { '@_name': 'name', '#text': 'Fog of War' },
                  { '@_name': 'width', '#text': '6' },
                  { '@_name': 'height', '#text': '8' },
                ],
              },
            ],
          },
        ],
      };

      const result = parseTableMask(data, 'test.xml');

      expect(result.id).toBe('mask-001');
      expect(result.type).toBe('table-mask');
      expect(result.name).toBe('Fog of War');
      expect(result.width).toBe(6);
      expect(result.height).toBe(8);
    });

    it('should use fileName as fallback for name and id', () => {
      const data = {
        data: [
          {
            '@_name': 'table-mask',
            data: [],
          },
        ],
      };

      const result = parseTableMask(data, 'fallback-mask.xml');

      expect(result.id).toBe('fallback-mask.xml');
      expect(result.name).toBe('fallback-mask.xml');
    });

    it('should use default values for dimensions', () => {
      const data = {
        data: [
          {
            '@_name': 'table-mask',
            data: [],
          },
        ],
      };

      const result = parseTableMask(data, 'test.xml');

      expect(result.width).toBe(4);
      expect(result.height).toBe(4);
    });

    it('should parse position', () => {
      const data = {
        '@_identifier': 'mask-002',
        '@_location.x': '150',
        '@_location.y': '250',
        '@_posZ': '4',
        data: [
          {
            '@_name': 'table-mask',
            data: [],
          },
        ],
      };

      const result = parseTableMask(data, 'test.xml');

      expect(result.position.x).toBe(150);
      expect(result.position.y).toBe(250);
      expect(result.position.z).toBe(4);
    });

    it('should parse position from location.x/location.y attributes', () => {
      const data = {
        '@_identifier': 'mask-004',
        '@_location.x': '300',
        '@_location.y': '400',
        '@_posZ': '5',
        data: [
          {
            '@_name': 'table-mask',
            data: [],
          },
        ],
      };

      const result = parseTableMask(data, 'test.xml');

      expect(result.position.x).toBe(300);
      expect(result.position.y).toBe(400);
      expect(result.position.z).toBe(5);
    });

    it('should default position to (0, 0)', () => {
      const data = {
        data: [
          {
            '@_name': 'table-mask',
            data: [],
          },
        ],
      };

      const result = parseTableMask(data, 'test.xml');

      expect(result.position.x).toBe(0);
      expect(result.position.y).toBe(0);
      expect(result.position.z).toBe(0);
    });

    it('should have empty images array', () => {
      const data = {
        '@_identifier': 'mask-003',
        data: [
          {
            '@_name': 'table-mask',
            data: [],
          },
        ],
      };

      const result = parseTableMask(data, 'test.xml');

      expect(result.images).toHaveLength(0);
    });

    it('should parse mask image identifier', () => {
      const data = {
        '@_identifier': 'mask-image',
        data: [
          {
            '@_name': 'table-mask',
            data: [
              {
                '@_name': 'image',
                data: [{ '@_name': 'imageIdentifier', '#text': 'none_icon' }],
              },
            ],
          },
        ],
      };

      const result = parseTableMask(data, 'test.xml');

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toEqual({
        identifier: 'none_icon',
        name: 'mask',
      });
    });

    it('should parse opacity from numberResource currentValue', () => {
      const data = {
        '@_identifier': 'mask-opacity',
        data: [
          {
            '@_name': 'table-mask',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'opacity', '@_currentValue': '30', '#text': '100' }],
              },
            ],
          },
        ],
      };

      const result = parseTableMask(data, 'test.xml');

      expect(result.properties.get('opacity')).toBe(30);
    });

    it('should handle empty data gracefully', () => {
      const data = {};

      const result = parseTableMask(data, 'empty.xml');

      expect(result.id).toBe('empty.xml');
      expect(result.name).toBe('empty.xml');
      expect(result.width).toBe(4);
      expect(result.height).toBe(4);
    });

    it('should parse isLocked as false when attribute is "false"', () => {
      const data = {
        '@_identifier': 'mask-unlocked',
        '@_isLock': 'false',
        data: [
          {
            '@_name': 'table-mask',
            data: [],
          },
        ],
      };

      const result = parseTableMask(data, 'test.xml');

      expect(result.isLocked).toBe(false);
    });

    it('should parse isLocked as true when attribute is "true"', () => {
      const data = {
        '@_identifier': 'mask-locked',
        '@_isLock': 'true',
        data: [
          {
            '@_name': 'table-mask',
            data: [],
          },
        ],
      };

      const result = parseTableMask(data, 'test.xml');

      expect(result.isLocked).toBe(true);
    });

    it('should default isLocked to false when attribute is missing', () => {
      const data = {
        '@_identifier': 'mask-default',
        data: [
          {
            '@_name': 'table-mask',
            data: [],
          },
        ],
      };

      const result = parseTableMask(data, 'test.xml');

      expect(result.isLocked).toBe(false);
    });
  });
});
