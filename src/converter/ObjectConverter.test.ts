import { describe, it, expect } from 'vitest';
import {
  convertPosition,
  convertSize,
  convertObjectWithTextures,
  convertObjectsWithTextureMap,
} from './ObjectConverter';
import { SCALE_FACTOR } from '../config/MappingConfig';
import type {
  GameCharacter,
  DiceSymbol,
  Card,
  CardStack,
  Terrain,
  GameTable,
  TableMask,
  TextNote,
} from '../domain/UdonariumObject';
import { COMPONENT_TYPES } from '../config/ResoniteComponentTypes';

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

  describe('convertObjectWithTextures', () => {
    const createBaseObject = () => ({
      id: 'test-id',
      name: 'Test Object',
      position: { x: 100, y: 200, z: 50 },
      images: [{ identifier: 'img1', name: 'image1.png' }],
    });

    describe('character conversion', () => {
      it('should convert character with size scaling', () => {
        const character: GameCharacter = {
          ...createBaseObject(),
          type: 'character',
          locationName: 'table',
          size: 2,
          rotate: 0,
          roll: 0,
        };

        const result = convertObjectWithTextures(character, new Map());

        expect(result.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
        expect(result.name).toBe('Test Object');
        // convertPosition(100, 200, 50) = {x:2, y:1, z:-4}, then +size/2 offset on x/y/z (z is negative direction)
        const basePos = convertPosition(100, 200, 50);
        expect(result.position).toEqual({
          x: basePos.x + character.size / 2,
          y: basePos.y + character.size / 2,
          z: basePos.z - character.size / 2,
        });
      });

      it('should apply image aspect ratio to character mesh while keeping width equal to size', () => {
        const character: GameCharacter = {
          ...createBaseObject(),
          type: 'character',
          locationName: 'table',
          size: 2,
          images: [{ identifier: 'char-aspect', name: 'char-aspect.png' }],
          rotate: 0,
          roll: 0,
        };
        const imageAspectRatioMap = new Map<string, number>([['char-aspect', 1.5]]);

        const [result] = convertObjectsWithTextureMap([character], new Map(), imageAspectRatioMap);

        const quad = result.components.find((c) => c.type === COMPONENT_TYPES.QUAD_MESH);
        expect(quad?.fields.Size).toEqual({ $type: 'float2', value: { x: 2, y: 3 } });
        expect(result.position).toEqual({
          x: 3,
          y: 2.5,
          z: -5,
        });
      });
    });

    describe('dice-symbol conversion', () => {
      it('should convert dice-symbol with size scaling', () => {
        const dice: DiceSymbol = {
          ...createBaseObject(),
          type: 'dice-symbol',
          size: 2,
          face: '6',
          rotate: 0,
          images: [
            { identifier: 'dice-face-6', name: '6' },
            { identifier: 'dice-face-1', name: '1' },
          ],
          faceImages: [
            { identifier: 'dice-face-1', name: '1' },
            { identifier: 'dice-face-6', name: '6' },
          ],
        };

        const result = convertObjectWithTextures(dice, new Map());

        expect(result.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
        const basePos = convertPosition(100, 200, 50);
        expect(result.position).toEqual({
          x: basePos.x + dice.size / 2,
          y: basePos.y + dice.size / 2,
          z: basePos.z - dice.size / 2,
        });
        expect(result.children).toHaveLength(2);
        expect(result.children.map((child) => child.isActive)).toEqual([false, true]);
        expect(result.components.some((c) => c.type === COMPONENT_TYPES.GRABBABLE)).toBe(true);
        expect(result.components.some((c) => c.type === COMPONENT_TYPES.MESH_RENDERER)).toBe(false);
      });

      it('should size each face by image aspect ratio and bottom-align to largest face', () => {
        const dice: DiceSymbol = {
          ...createBaseObject(),
          type: 'dice-symbol',
          size: 2,
          face: 'large',
          rotate: 0,
          images: [
            { identifier: 'small-face', name: 'small' },
            { identifier: 'large-face', name: 'large' },
          ],
          faceImages: [
            { identifier: 'small-face', name: 'small' },
            { identifier: 'large-face', name: 'large' },
          ],
        };
        const imageAspectRatioMap = new Map<string, number>([
          ['small-face', 1],
          ['large-face', 2],
        ]);

        const [result] = convertObjectsWithTextureMap([dice], new Map(), imageAspectRatioMap);

        const basePos = convertPosition(100, 200, 50);
        expect(result.position).toEqual({
          x: basePos.x + 1,
          y: basePos.y + 2,
          z: basePos.z - 1,
        });
        const collider = result.components.find((c) => c.type === COMPONENT_TYPES.BOX_COLLIDER);
        expect(collider?.fields).toEqual({
          Size: { $type: 'float3', value: { x: 2, y: 4, z: 0.05 } },
        });
        expect(result.children[0].position.y).toBe(-1);
        expect(result.children[1].position.y).toBeCloseTo(0);

        const smallQuad = result.children[0].components.find(
          (c) => c.type === COMPONENT_TYPES.QUAD_MESH
        );
        const largeQuad = result.children[1].components.find(
          (c) => c.type === COMPONENT_TYPES.QUAD_MESH
        );
        expect(smallQuad?.fields.Size).toEqual({ $type: 'float2', value: { x: 2, y: 2 } });
        expect(largeQuad?.fields.Size).toEqual({ $type: 'float2', value: { x: 2, y: 4 } });
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
          width: 10,
          height: 5,
          depth: 3,
          wallImage: null,
          floorImage: null,
        };

        const result = convertObjectWithTextures(terrain, new Map());

        expect(result.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
      });

      it('should disable CharacterCollider on locked terrain when option is false', () => {
        const terrain: Terrain = {
          ...createBaseObject(),
          type: 'terrain',
          isLocked: true,
          mode: 3,
          rotate: 0,
          width: 10,
          height: 5,
          depth: 3,
          wallImage: null,
          floorImage: null,
        };

        const [result] = convertObjectsWithTextureMap([terrain], new Map(), undefined, undefined, {
          enableCharacterColliderOnLockedTerrain: false,
        });
        const collider = result.components.find((c) => c.type === COMPONENT_TYPES.BOX_COLLIDER);

        expect(collider).toBeDefined();
        expect(collider?.fields).toEqual({
          Size: {
            $type: 'float3',
            value: { x: 10, y: 5, z: 3 },
          },
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
          children: [],
        };

        const result = convertObjectWithTextures(table, new Map());

        expect(result.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);

        expect(result.position.y).toBe(1);
      });

      it('should enable CharacterCollider on table visual collider when option is true', () => {
        const table: GameTable = {
          ...createBaseObject(),
          type: 'table',
          width: 20,
          height: 20,
          gridType: 'square',
          gridColor: '#000000',
          children: [],
        };

        const [result] = convertObjectsWithTextureMap([table], new Map(), undefined, undefined, {
          enableCharacterColliderOnLockedTerrain: true,
        });
        const visual = result.children[0];
        const collider = visual.components.find((c) => c.type === COMPONENT_TYPES.BOX_COLLIDER);

        expect(collider).toBeDefined();
        expect(collider?.fields).toEqual({
          Size: { $type: 'float3', value: { x: 20, y: 20, z: 0 } },
          CharacterCollider: { $type: 'bool', value: true },
        });
      });
    });

    describe('card conversion', () => {
      it('should convert card with standard card size', () => {
        const card: Card = {
          ...createBaseObject(),
          type: 'card',
          size: 1,
          rotate: 0,
          isFaceUp: true,
          frontImage: { identifier: 'front', name: 'front.png' },
          backImage: { identifier: 'back', name: 'back.png' },
        };

        const result = convertObjectWithTextures(card, new Map());

        expect(result.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
      });
    });

    describe('card-stack conversion', () => {
      it('should convert card-stack with standard card size', () => {
        const cardStack: CardStack = {
          ...createBaseObject(),
          type: 'card-stack',
          rotate: 0,
          cards: [],
        };

        const result = convertObjectWithTextures(cardStack, new Map());

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

        const result = convertObjectWithTextures(textNote, new Map());

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
          opacity: 30,
        };

        const result = convertObjectWithTextures(tableMask, new Map());

        expect(result.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
        expect(result.rotation).toEqual({ x: 90, y: 0, z: 0 });
        expect(result.components.map((c) => c.type)).toContain(COMPONENT_TYPES.QUAD_MESH);
        expect(result.components.map((c) => c.type)).toContain(COMPONENT_TYPES.MESH_RENDERER);
      });
    });

    it('should add BoxCollider to all object types', () => {
      const objects = [
        {
          ...createBaseObject(),
          type: 'character' as const,
          locationName: 'table',
          size: 1,
          rotate: 0,
          roll: 0,
        },
        {
          ...createBaseObject(),
          type: 'dice-symbol' as const,
          size: 1,
          face: '1',
          rotate: 0,
          faceImages: [{ identifier: 'img1', name: '1' }],
        },
        {
          ...createBaseObject(),
          type: 'terrain' as const,
          isLocked: false,
          mode: 3,
          rotate: 0,
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
          size: 1,
          rotate: 0,
          isFaceUp: true,
          frontImage: { identifier: 'front', name: 'front.png' },
          backImage: { identifier: 'back', name: 'back.png' },
        },
        {
          ...createBaseObject(),
          type: 'card-stack' as const,
          rotate: 0,
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
        { x: 1, y: 1, z: 0.05 }, // dice-symbol -> converter-defined collider
        { x: 1, y: 1, z: 1 }, // terrain -> converter-defined collider
        { x: 1, y: 1, z: 0 }, // table -> collider on -surface child slot
        { x: 1, y: 0.01, z: 1 }, // card -> converter-defined collider
        { x: 1, y: 0.05, z: 1 }, // card-stack -> converter-defined collider
        { x: 1, y: 0.02, z: 1 }, // text-note -> converter-defined collider
      ];

      for (const [index, obj] of objects.entries()) {
        const result = convertObjectWithTextures(obj, new Map());
        // Table has collider on -surface child slot, others on the slot itself
        const searchTarget =
          obj.type === 'table' ? (result.children[0]?.components ?? []) : result.components;
        const collider = searchTarget.find((c) => c.type === COMPONENT_TYPES.BOX_COLLIDER);
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
        locationName: 'table',
        size: 1,
        rotate: 0,
        roll: 0,
      };

      const result = convertObjectWithTextures(character, new Map());

      expect(result.rotation).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should initialize empty children array', () => {
      const character: GameCharacter = {
        ...createBaseObject(),
        type: 'character',
        locationName: 'table',
        size: 1,
        rotate: 0,
        roll: 0,
      };

      const result = convertObjectWithTextures(character, new Map());

      expect(result.children).toEqual([]);
    });
  });

  describe('convertObjectsWithTextureMap', () => {
    it('should convert empty array', () => {
      const result = convertObjectsWithTextureMap([], new Map());
      expect(result).toEqual([]);
    });

    it('should convert multiple objects with unique UUIDs', () => {
      const objects: GameCharacter[] = [
        {
          id: 'char1',
          type: 'character',
          name: 'Character 1',
          locationName: 'table',
          position: { x: 0, y: 0, z: 0 },
          images: [],
          size: 1,
          rotate: 0,
          roll: 0,
        },
        {
          id: 'char2',
          type: 'character',
          name: 'Character 2',
          locationName: 'table',
          position: { x: 100, y: 100, z: 0 },
          images: [],
          size: 2,
          rotate: 0,
          roll: 0,
        },
      ];

      const result = convertObjectsWithTextureMap(objects, new Map());

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
          locationName: 'table',
          position: { x: 0, y: 0, z: 0 },
          images: [],
          size: 1,
          rotate: 0,
          roll: 0,
        },
        {
          id: 'data',
          type: 'character',
          name: 'Monster B',
          locationName: 'table',
          position: { x: 100, y: 0, z: 0 },
          images: [],
          size: 1,
          rotate: 0,
          roll: 0,
        },
        {
          id: 'data',
          type: 'character',
          name: 'Monster C',
          locationName: 'table',
          position: { x: 200, y: 0, z: 0 },
          images: [],
          size: 1,
          rotate: 0,
          roll: 0,
        },
      ];

      const result = convertObjectsWithTextureMap(objects, new Map());

      expect(result).toHaveLength(3);
      const ids = new Set(result.map((r) => r.id));
      expect(ids.size).toBe(3);
      for (const r of result) {
        expect(r.id).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
      }
    });

    it('shows only selected table when multiple tables exist', () => {
      const createTable = (id: string, name: string, selected: boolean): GameTable => ({
        id,
        type: 'table',
        name,
        position: { x: 0, y: 0, z: 0 },
        images: [],
        width: 20,
        height: 15,
        gridType: 'SQUARE',
        gridColor: '#000000',
        selected,
        children: [],
      });
      const character: GameCharacter = {
        id: 'char-1',
        type: 'character',
        name: 'Character 1',
        locationName: 'table',
        position: { x: 0, y: 0, z: 0 },
        images: [],
        size: 1,
        rotate: 0,
        roll: 0,
      };

      const result = convertObjectsWithTextureMap(
        [
          createTable('table-1', 'Table 1', true),
          createTable('table-2', 'Table 2', false),
          character,
        ],
        new Map()
      );

      expect(result[0].isActive).toBe(true);
      expect(result[1].isActive).toBe(false);
      expect(result[2].isActive).toBe(true);
    });
  });
});
