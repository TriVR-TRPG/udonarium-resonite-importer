import { describe, it, expect } from 'vitest';
import { convertPosition, convertSize, convertObject, convertObjects } from './ObjectConverter';
import { SIZE_MULTIPLIER, SCALE_FACTOR } from '../config/MappingConfig';
import type {
  GameCharacter,
  Card,
  CardStack,
  Terrain,
  GameTable,
  TextNote,
} from './UdonariumObject';

describe('ObjectConverter', () => {
  describe('convertPosition', () => {
    it('should convert origin (0, 0) to origin', () => {
      const result = convertPosition(0, 0);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      // Note: -0 * SCALE_FACTOR = -0, which is equal to 0 numerically
      expect(result.z).toBeCloseTo(0);
    });

    it('should scale X coordinate by SCALE_FACTOR', () => {
      const result = convertPosition(100, 0);
      expect(result.x).toBe(100 * SCALE_FACTOR);
      expect(result.y).toBe(0);
      expect(result.z).toBeCloseTo(0);
    });

    it('should invert and scale Y to Z coordinate', () => {
      const result = convertPosition(0, 100);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.z).toBe(-100 * SCALE_FACTOR);
    });

    it('should handle negative coordinates', () => {
      const result = convertPosition(-50, -75);
      expect(result.x).toBe(-50 * SCALE_FACTOR);
      expect(result.y).toBe(0);
      expect(result.z).toBe(75 * SCALE_FACTOR);
    });

    it('should convert typical Udonarium pixel values', () => {
      // 50px = 1 grid = 1m in Resonite
      const result = convertPosition(50, 50);
      expect(result.x).toBeCloseTo(1); // 50 * 0.02 = 1
      expect(result.z).toBeCloseTo(-1); // -50 * 0.02 = -1
    });
  });

  describe('convertSize', () => {
    it('should convert size 1 to SIZE_MULTIPLIER', () => {
      const result = convertSize(1);
      expect(result).toEqual({
        x: SIZE_MULTIPLIER,
        y: SIZE_MULTIPLIER,
        z: SIZE_MULTIPLIER,
      });
    });

    it('should scale size uniformly', () => {
      const result = convertSize(5);
      expect(result.x).toBe(5 * SIZE_MULTIPLIER);
      expect(result.y).toBe(5 * SIZE_MULTIPLIER);
      expect(result.z).toBe(5 * SIZE_MULTIPLIER);
    });

    it('should handle decimal sizes', () => {
      const result = convertSize(1.5);
      expect(result.x).toBeCloseTo(1.5 * SIZE_MULTIPLIER);
    });
  });

  describe('convertObject', () => {
    const createBaseObject = () => ({
      id: 'test-id',
      name: 'Test Object',
      position: { x: 100, y: 200 },
      images: [{ identifier: 'img1', name: 'image1.png' }],
      properties: new Map<string, string | number>(),
    });

    describe('character conversion', () => {
      it('should convert character with size scaling', () => {
        const character: GameCharacter = {
          ...createBaseObject(),
          type: 'character',
          size: 2,
          resources: [],
        };

        const result = convertObject(character);

        expect(result.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
        expect(result.name).toBe('Test Object');
        expect(result.position).toEqual(convertPosition(100, 200));
        expect(result.scale).toEqual(convertSize(2));
        expect(result.textures).toEqual(['img1']);
      });
    });

    describe('terrain conversion', () => {
      it('should convert terrain with width/height/depth scaling', () => {
        const terrain: Terrain = {
          ...createBaseObject(),
          type: 'terrain',
          width: 10,
          height: 5,
          depth: 3,
          wallImage: null,
          floorImage: null,
        };

        const result = convertObject(terrain);

        expect(result.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
        expect(result.scale).toEqual({
          x: 10 * SIZE_MULTIPLIER,
          y: 5 * SIZE_MULTIPLIER,
          z: 3 * SIZE_MULTIPLIER,
        });
      });
    });

    describe('table conversion', () => {
      it('should convert table with special thin scale', () => {
        const table: GameTable = {
          ...createBaseObject(),
          type: 'table',
          width: 20,
          height: 20,
          gridType: 'square',
          gridColor: '#000000',
        };

        const result = convertObject(table);

        expect(result.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
        expect(result.scale).toEqual({
          x: 20 * SIZE_MULTIPLIER,
          y: 0.1,
          z: 20 * SIZE_MULTIPLIER,
        });
        expect(result.position.y).toBe(-0.1);
      });
    });

    describe('card conversion', () => {
      it('should convert card with standard card size', () => {
        const card: Card = {
          ...createBaseObject(),
          type: 'card',
          isFaceUp: true,
          frontImage: { identifier: 'front', name: 'front.png' },
          backImage: { identifier: 'back', name: 'back.png' },
        };

        const result = convertObject(card);

        expect(result.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
        expect(result.scale).toEqual({ x: 0.6, y: 0.01, z: 0.9 });
      });
    });

    describe('card-stack conversion', () => {
      it('should convert card-stack with standard card size', () => {
        const cardStack: CardStack = {
          ...createBaseObject(),
          type: 'card-stack',
          cards: [],
        };

        const result = convertObject(cardStack);

        expect(result.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
        expect(result.scale).toEqual({ x: 0.6, y: 0.01, z: 0.9 });
      });
    });

    describe('text-note conversion', () => {
      it('should convert text-note with standard size', () => {
        const textNote: TextNote = {
          ...createBaseObject(),
          type: 'text-note',
          text: 'Hello World',
          fontSize: 14,
        };

        const result = convertObject(textNote);

        expect(result.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
        expect(result.scale).toEqual({ x: 1, y: 1, z: 1 });
      });
    });

    it('should add BoxCollider to all object types', () => {
      const objects = [
        {
          ...createBaseObject(),
          type: 'character' as const,
          size: 1,
          resources: [],
        },
        {
          ...createBaseObject(),
          type: 'terrain' as const,
          width: 1,
          height: 1,
          depth: 1,
          wallImage: null,
          floorImage: null,
        },
        {
          ...createBaseObject(),
          type: 'table' as const,
          width: 1,
          height: 1,
          gridType: 'square' as const,
          gridColor: '#000000',
        },
        {
          ...createBaseObject(),
          type: 'card' as const,
          isFaceUp: true,
          frontImage: { identifier: 'front', name: 'front.png' },
          backImage: { identifier: 'back', name: 'back.png' },
        },
        {
          ...createBaseObject(),
          type: 'card-stack' as const,
          cards: [],
        },
        {
          ...createBaseObject(),
          type: 'text-note' as const,
          text: 'note',
          fontSize: 12,
        },
      ];

      for (const obj of objects) {
        const result = convertObject(obj);
        expect(
          result.components.some((c) => c.type === '[FrooxEngine]FrooxEngine.BoxCollider')
        ).toBe(true);
      }
    });

    it('should preserve rotation as zero', () => {
      const character: GameCharacter = {
        ...createBaseObject(),
        type: 'character',
        size: 1,
        resources: [],
      };

      const result = convertObject(character);

      expect(result.rotation).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should map image identifiers to textures', () => {
      const character: GameCharacter = {
        ...createBaseObject(),
        type: 'character',
        size: 1,
        resources: [],
        images: [
          { identifier: 'img1', name: 'image1.png' },
          { identifier: 'img2', name: 'image2.png' },
        ],
      };

      const result = convertObject(character);

      expect(result.textures).toEqual(['img1', 'img2']);
    });

    it('should initialize empty children array', () => {
      const character: GameCharacter = {
        ...createBaseObject(),
        type: 'character',
        size: 1,
        resources: [],
      };

      const result = convertObject(character);

      expect(result.children).toEqual([]);
    });
  });

  describe('convertObjects', () => {
    it('should convert empty array', () => {
      const result = convertObjects([]);
      expect(result).toEqual([]);
    });

    it('should convert multiple objects with unique UUIDs', () => {
      const objects: GameCharacter[] = [
        {
          id: 'char1',
          type: 'character',
          name: 'Character 1',
          position: { x: 0, y: 0 },
          images: [],
          properties: new Map(),
          size: 1,
          resources: [],
        },
        {
          id: 'char2',
          type: 'character',
          name: 'Character 2',
          position: { x: 100, y: 100 },
          images: [],
          properties: new Map(),
          size: 2,
          resources: [],
        },
      ];

      const result = convertObjects(objects);

      expect(result).toHaveLength(2);
      expect(result[0].id).toMatch(/^udon-imp-/);
      expect(result[1].id).toMatch(/^udon-imp-/);
      expect(result[0].id).not.toBe(result[1].id);
    });

    it('should generate unique IDs even for objects with same source id', () => {
      const objects: GameCharacter[] = [
        {
          id: 'data',
          type: 'character',
          name: 'Monster A',
          position: { x: 0, y: 0 },
          images: [],
          properties: new Map(),
          size: 1,
          resources: [],
        },
        {
          id: 'data',
          type: 'character',
          name: 'Monster B',
          position: { x: 100, y: 0 },
          images: [],
          properties: new Map(),
          size: 1,
          resources: [],
        },
        {
          id: 'data',
          type: 'character',
          name: 'Monster C',
          position: { x: 200, y: 0 },
          images: [],
          properties: new Map(),
          size: 1,
          resources: [],
        },
      ];

      const result = convertObjects(objects);

      expect(result).toHaveLength(3);
      const ids = new Set(result.map((r) => r.id));
      expect(ids.size).toBe(3);
      for (const r of result) {
        expect(r.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
      }
    });
  });
});
