import { describe, it, expect } from 'vitest';
import { convertPosition, convertSize, convertObject, convertObjects } from './ObjectConverter';
import { SCALE_FACTOR } from '../config/MappingConfig';
import type {
  GameCharacter,
  Card,
  CardStack,
  Terrain,
  GameTable,
  TableMask,
  TextNote,
} from '../domain/UdonariumObject';

describe('ObjectConverter', () => {
  describe('convertPosition', () => {
    it('should convert origin (0, 0, 0) to origin', () => {
      const result = convertPosition(0, 0, 0);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      // Note: -0 * SCALE_FACTOR = -0, which is equal to 0 numerically
      expect(result.z).toBeCloseTo(0);
    });

    it('should scale X coordinate by SCALE_FACTOR', () => {
      const result = convertPosition(100, 0, 0);
      expect(result.x).toBe(100 * SCALE_FACTOR);
      expect(result.y).toBe(0);
      expect(result.z).toBeCloseTo(0);
    });

    it('should invert and scale Y to Z coordinate', () => {
      const result = convertPosition(0, 100, 0);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.z).toBe(-100 * SCALE_FACTOR);
    });

    it('should handle negative coordinates', () => {
      const result = convertPosition(-50, -75, 0);
      expect(result.x).toBe(-50 * SCALE_FACTOR);
      expect(result.y).toBe(0);
      expect(result.z).toBe(75 * SCALE_FACTOR);
    });

    it('should convert typical Udonarium pixel values', () => {
      // 50px = 1 grid = 1m in Resonite
      const result = convertPosition(50, 50, 0);
      expect(result.x).toBeCloseTo(1); // 50 * 0.02 = 1
      expect(result.z).toBeCloseTo(-1); // -50 * 0.02 = -1
    });
  });

  describe('convertSize', () => {
    it('should keep size 1 as-is', () => {
      const result = convertSize(1);
      expect(result).toEqual({
        x: 1,
        y: 1,
        z: 1,
      });
    });

    it('should keep size value uniformly', () => {
      const result = convertSize(5);
      expect(result.x).toBe(5);
      expect(result.y).toBe(5);
      expect(result.z).toBe(5);
    });

    it('should handle decimal sizes', () => {
      const result = convertSize(1.5);
      expect(result.x).toBeCloseTo(1.5);
    });
  });

  describe('convertObject', () => {
    const createBaseObject = () => ({
      id: 'test-id',
      name: 'Test Object',
      position: { x: 100, y: 200, z: 50 },
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
        // convertPosition(100, 200, 50) = {x:2, y:1, z:-4}, then +size/2 offset on x/y/z (z is negative direction)
        const basePos = convertPosition(100, 200, 50);
        expect(result.position).toEqual({
          x: basePos.x + character.size / 2,
          y: basePos.y + character.size / 2,
          z: basePos.z - character.size / 2,
        });

        expect(result.textures).toEqual(['img1']);
      });
    });

    describe('terrain conversion', () => {
      it('should convert terrain with width/height/depth scaling', () => {
        const terrain: Terrain = {
          ...createBaseObject(),
          type: 'terrain',
          isLocked: false,
          mode: 3,
          rotate: 0,
          locationName: 'table',
          width: 10,
          height: 5,
          depth: 3,
          wallImage: null,
          floorImage: null,
        };

        const result = convertObject(terrain);

        expect(result.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
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
          children: [],
        };

        const result = convertObject(table);

        expect(result.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);

        expect(result.position.y).toBe(1);
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
      });
    });

    describe('table-mask conversion', () => {
      it('should convert table-mask into visible quad components', () => {
        const tableMask: TableMask = {
          ...createBaseObject(),
          type: 'table-mask',
          isLock: false,
          width: 5,
          height: 4,
          properties: new Map([['opacity', 30]]),
        };

        const result = convertObject(tableMask);

        expect(result.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
        expect(result.rotation).toEqual({ x: 90, y: 0, z: 0 });
        expect(result.components.map((c) => c.type)).toContain('[FrooxEngine]FrooxEngine.QuadMesh');
        expect(result.components.map((c) => c.type)).toContain(
          '[FrooxEngine]FrooxEngine.MeshRenderer'
        );
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
          isLocked: false,
          mode: 3,
          rotate: 0,
          locationName: 'table',
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
          children: [],
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
      const expectedSizes = [
        { x: 1, y: 1, z: 0.05 }, // character -> converter-defined collider
        { x: 1, y: 1, z: 1 }, // terrain -> converter-defined collider
        { x: 1, y: 1, z: 0 }, // table -> collider on -surface child slot
        { x: 1, y: 0.01, z: 1 }, // card -> converter-defined collider
        { x: 1, y: 0.05, z: 1 }, // card-stack -> converter-defined collider
        { x: 1, y: 0.02, z: 1 }, // text-note -> converter-defined collider
      ];

      for (const [index, obj] of objects.entries()) {
        const result = convertObject(obj);
        // Table has collider on -surface child slot, others on the slot itself
        const searchTarget =
          obj.type === 'table' ? (result.children[0]?.components ?? []) : result.components;
        const collider = searchTarget.find(
          (c) => c.type === '[FrooxEngine]FrooxEngine.BoxCollider'
        );
        expect(collider).toBeDefined();
        expect(collider?.fields).toEqual({
          Size: {
            $type: 'float3',
            value: expectedSizes[index],
          },
        });
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
          position: { x: 0, y: 0, z: 0 },
          images: [],
          properties: new Map(),
          size: 1,
          resources: [],
        },
        {
          id: 'char2',
          type: 'character',
          name: 'Character 2',
          position: { x: 100, y: 100, z: 0 },
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
          position: { x: 0, y: 0, z: 0 },
          images: [],
          properties: new Map(),
          size: 1,
          resources: [],
        },
        {
          id: 'data',
          type: 'character',
          name: 'Monster B',
          position: { x: 100, y: 0, z: 0 },
          images: [],
          properties: new Map(),
          size: 1,
          resources: [],
        },
        {
          id: 'data',
          type: 'character',
          name: 'Monster C',
          position: { x: 200, y: 0, z: 0 },
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
