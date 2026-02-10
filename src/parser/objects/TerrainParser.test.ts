/**
 * Tests for TerrainParser
 */

import { describe, it, expect } from 'vitest';
import { parseTerrain } from './TerrainParser';

describe('TerrainParser', () => {
  describe('parseTerrain', () => {
    it('should parse basic terrain with name and dimensions', () => {
      const data = {
        '@_identifier': 'terrain-001',
        data: [
          {
            '@_name': 'terrain',
            data: [
              {
                '@_name': 'common',
                data: [
                  { '@_name': 'name', '#text': 'Mountain' },
                  { '@_name': 'width', '#text': '3' },
                  { '@_name': 'height', '#text': '2' },
                  { '@_name': 'depth', '#text': '4' },
                ],
              },
            ],
          },
        ],
      };

      const result = parseTerrain(data, 'test.xml');

      expect(result.id).toBe('terrain-001');
      expect(result.type).toBe('terrain');
      expect(result.name).toBe('Mountain');
      expect(result.width).toBe(3);
      expect(result.height).toBe(2);
      expect(result.depth).toBe(4);
    });

    it('should use fileName as fallback for name and id', () => {
      const data = {
        data: [
          {
            '@_name': 'terrain',
            data: [],
          },
        ],
      };

      const result = parseTerrain(data, 'fallback-terrain.xml');

      expect(result.id).toBe('fallback-terrain.xml');
      expect(result.name).toBe('fallback-terrain.xml');
    });

    it('should default dimensions to 1', () => {
      const data = {
        data: [
          {
            '@_name': 'terrain',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'Small' }],
              },
            ],
          },
        ],
      };

      const result = parseTerrain(data, 'test.xml');

      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
      expect(result.depth).toBe(1);
    });

    it('should parse wall and floor images', () => {
      const data = {
        '@_identifier': 'terrain-002',
        data: [
          {
            '@_name': 'terrain',
            data: [
              {
                '@_name': 'image',
                data: [
                  { '@_name': 'wall', '#text': 'wall-texture-001' },
                  { '@_name': 'floor', '#text': 'floor-texture-001' },
                ],
              },
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'Textured Terrain' }],
              },
            ],
          },
        ],
      };

      const result = parseTerrain(data, 'test.xml');

      expect(result.wallImage).not.toBeNull();
      expect(result.wallImage?.identifier).toBe('wall-texture-001');
      expect(result.wallImage?.name).toBe('wall');

      expect(result.floorImage).not.toBeNull();
      expect(result.floorImage?.identifier).toBe('floor-texture-001');
      expect(result.floorImage?.name).toBe('floor');

      expect(result.images).toHaveLength(2);
    });

    it('should handle terrain with only wall image', () => {
      const data = {
        '@_identifier': 'terrain-003',
        data: [
          {
            '@_name': 'terrain',
            data: [
              {
                '@_name': 'image',
                data: [{ '@_name': 'wall', '#text': 'wall-only' }],
              },
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'Wall Only' }],
              },
            ],
          },
        ],
      };

      const result = parseTerrain(data, 'test.xml');

      expect(result.wallImage).not.toBeNull();
      expect(result.floorImage).toBeNull();
      expect(result.images).toHaveLength(1);
    });

    it('should handle terrain with only floor image', () => {
      const data = {
        '@_identifier': 'terrain-004',
        data: [
          {
            '@_name': 'terrain',
            data: [
              {
                '@_name': 'image',
                data: [{ '@_name': 'floor', '#text': 'floor-only' }],
              },
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'Floor Only' }],
              },
            ],
          },
        ],
      };

      const result = parseTerrain(data, 'test.xml');

      expect(result.wallImage).toBeNull();
      expect(result.floorImage).not.toBeNull();
      expect(result.images).toHaveLength(1);
    });

    it('should parse position', () => {
      const data = {
        '@_identifier': 'terrain-005',
        '@_posX': '500',
        '@_posY': '600',
        '@_posZ': '30',
        data: [
          {
            '@_name': 'terrain',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'Positioned' }],
              },
            ],
          },
        ],
      };

      const result = parseTerrain(data, 'test.xml');

      expect(result.position.x).toBe(500);
      expect(result.position.y).toBe(600);
      expect(result.position.z).toBe(30);
    });

    it('should default position to (0, 0)', () => {
      const data = {
        data: [
          {
            '@_name': 'terrain',
            data: [],
          },
        ],
      };

      const result = parseTerrain(data, 'test.xml');

      expect(result.position.x).toBe(0);
      expect(result.position.y).toBe(0);
      expect(result.position.z).toBe(0);
    });

    it('should parse position from location.x/location.y attributes', () => {
      const data = {
        '@_identifier': 'terrain-006',
        '@_location.x': '575',
        '@_location.y': '175',
        '@_posZ': '100',
        data: [
          {
            '@_name': 'terrain',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': '地形' }],
              },
            ],
          },
        ],
      };

      const result = parseTerrain(data, 'test.xml');

      expect(result.position.x).toBe(575);
      expect(result.position.y).toBe(175);
      expect(result.position.z).toBe(100);
    });

    it('should prefer location.x/location.y over posX/posY', () => {
      const data = {
        '@_identifier': 'terrain-007',
        '@_location.x': '575',
        '@_location.y': '175',
        '@_posX': '100',
        '@_posY': '200',
        '@_posZ': '50',
        data: [
          {
            '@_name': 'terrain',
            data: [],
          },
        ],
      };

      const result = parseTerrain(data, 'test.xml');

      expect(result.position.x).toBe(575);
      expect(result.position.y).toBe(175);
      expect(result.position.z).toBe(50);
    });

    it('should handle empty data gracefully', () => {
      const data = {};

      const result = parseTerrain(data, 'empty.xml');

      expect(result.id).toBe('empty.xml');
      expect(result.name).toBe('empty.xml');
      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
      expect(result.depth).toBe(1);
      expect(result.wallImage).toBeNull();
      expect(result.floorImage).toBeNull();
      expect(result.images).toHaveLength(0);
    });
  });
});
