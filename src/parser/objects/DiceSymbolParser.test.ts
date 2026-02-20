/**
 * Tests for DiceSymbolParser
 */

import { describe, it, expect } from 'vitest';
import { parseDiceSymbol } from './DiceSymbolParser';

describe('DiceSymbolParser', () => {
  describe('parseDiceSymbol', () => {
    it('should parse basic dice-symbol with face images and current face', () => {
      const data = {
        '@_identifier': 'dice-001',
        '@_face': '6',
        '@_rotate': '-30',
        '@_location.x': '120',
        '@_location.y': '220',
        '@_posZ': '10',
        data: [
          {
            '@_name': 'dice-symbol',
            data: [
              {
                '@_name': 'image',
                data: [
                  { '@_type': 'image', '@_name': '1', '#text': 'dice-face-1' },
                  { '@_type': 'image', '@_name': '6', '#text': 'dice-face-6' },
                ],
              },
              {
                '@_name': 'common',
                data: [
                  { '@_name': 'name', '#text': 'D6' },
                  { '@_name': 'size', '#text': '1.5' },
                ],
              },
            ],
          },
        ],
      };

      const result = parseDiceSymbol(data, 'dice.xml');

      expect(result.id).toBe('dice-001');
      expect(result.type).toBe('dice-symbol');
      expect(result.name).toBe('D6');
      expect(result.size).toBe(1.5);
      expect(result.face).toBe('6');
      expect(result.rotate).toBe(-30);
      expect(result.position).toEqual({ x: 120, y: 220, z: 10 });

      expect(result.faceImages).toHaveLength(2);
      expect(result.faceImages[0]).toEqual({ identifier: 'dice-face-1', name: '1' });
      expect(result.faceImages[1]).toEqual({ identifier: 'dice-face-6', name: '6' });

      // current face image should be first in images
      expect(result.images).toHaveLength(2);
      expect(result.images[0]).toEqual({ identifier: 'dice-face-6', name: '6' });
      expect(result.images[1]).toEqual({ identifier: 'dice-face-1', name: '1' });
    });

    it('should use first face as current image when face is missing', () => {
      const data = {
        data: [
          {
            '@_name': 'dice-symbol',
            data: [
              {
                '@_name': 'image',
                data: [
                  { '@_type': 'image', '@_name': '1', '#text': 'dice-face-1' },
                  { '@_type': 'image', '@_name': '2', '#text': 'dice-face-2' },
                ],
              },
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'D2' }],
              },
            ],
          },
        ],
      };

      const result = parseDiceSymbol(data, 'fallback.xml');

      expect(result.id).toBe('fallback.xml');
      expect(result.name).toBe('D2');
      expect(result.size).toBe(1);
      expect(result.rotate).toBe(0);
      expect(result.face).toBeUndefined();
      expect(result.images[0]).toEqual({ identifier: 'dice-face-1', name: '1' });
      expect(result.images[1]).toEqual({ identifier: 'dice-face-2', name: '2' });
    });

    it('should ignore non-image entries and empty identifiers', () => {
      const data = {
        '@_identifier': 'dice-003',
        data: [
          {
            '@_name': 'dice-symbol',
            data: [
              {
                '@_name': 'image',
                data: [
                  { '@_type': 'text', '@_name': 'label', '#text': 'ignore-me' },
                  { '@_type': 'image', '@_name': '1', '#text': '' },
                  { '@_type': 'image', '@_name': '2', '#text': 'dice-face-2' },
                ],
              },
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'D?' }],
              },
            ],
          },
        ],
      };

      const result = parseDiceSymbol(data, 'test.xml');

      expect(result.faceImages).toHaveLength(1);
      expect(result.faceImages[0]).toEqual({ identifier: 'dice-face-2', name: '2' });
      expect(result.images).toHaveLength(1);
    });
  });
});
