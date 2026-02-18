import { describe, expect, it, vi } from 'vitest';
import { convertCardStack } from './cardStackConverter';
import { Card, CardStack, UdonariumObject } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';

describe('convertCardStack', () => {
  it('reverses card order and applies stack offsets', () => {
    const cardA: Card = {
      id: 'card-a',
      type: 'card',
      name: 'A',
      position: { x: 1, y: 2, z: 0 },
      images: [],
      properties: new Map(),
      size: 2,
      isFaceUp: true,
      frontImage: null,
      backImage: null,
    };
    const cardB: Card = {
      ...cardA,
      id: 'card-b',
      name: 'B',
    };
    const udonObj: CardStack = {
      id: 'stack-1',
      type: 'card-stack',
      name: 'Stack',
      rotate: 45,
      position: { x: 0, y: 0, z: 0 },
      images: [],
      properties: new Map(),
      cards: [cardA, cardB],
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-stack-1',
      name: 'Stack',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      textures: [],
      components: [{ type: 'dummy', fields: {} }],
      children: [],
    };
    const convertObject = vi.fn(
      (obj: UdonariumObject): ResoniteObject => ({
        id: `slot-${obj.id}`,
        name: obj.name,
        position: { x: 9, y: 9, z: 9 },
        rotation: { x: 0, y: 0, z: 0 },
        textures: [],
        components: [],
        children: [],
      })
    );

    const result = convertCardStack(udonObj, resoniteObj, convertObject);

    expect(convertObject).toHaveBeenCalledTimes(2);
    expect(convertObject).toHaveBeenNthCalledWith(1, cardB);
    expect(convertObject).toHaveBeenNthCalledWith(2, cardA);
    expect(result.components).toEqual([
      {
        id: 'slot-stack-1-collider',
        type: '[FrooxEngine]FrooxEngine.BoxCollider',
        fields: {
          Size: { $type: 'float3', value: { x: 2, y: 0.05, z: 2 } },
        },
      },
      {
        id: 'slot-stack-1-grabbable',
        type: '[FrooxEngine]FrooxEngine.Grabbable',
        fields: {
          Scalable: { $type: 'bool', value: true },
        },
      },
    ]);
    expect(result.position).toEqual({ x: 1, y: 0.001, z: -1 });
    expect(result.rotation).toEqual({ x: 0, y: 45, z: 0 });
    expect(result.children).toHaveLength(2);
    expect(result.children[0].name).toBe('B');
    expect(result.children[1].name).toBe('A');
    expect(result.children[0].position).toEqual({ x: 0, y: 0, z: 0 });
    expect(result.children[1].position).toEqual({ x: 0, y: 0.0005, z: 0 });
  });

  it('uses image aspect ratio map to determine stack collider size', () => {
    const card: Card = {
      id: 'card-a',
      type: 'card',
      name: 'A',
      position: { x: 0, y: 0, z: 0 },
      images: [{ identifier: 'front.png', name: 'front' }],
      properties: new Map(),
      size: 2,
      isFaceUp: true,
      frontImage: { identifier: 'front.png', name: 'front' },
      backImage: null,
    };
    const udonObj: CardStack = {
      id: 'stack-2',
      type: 'card-stack',
      name: 'Stack',
      position: { x: 0, y: 0, z: 0 },
      images: [],
      properties: new Map(),
      cards: [card],
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-stack-2',
      name: 'Stack',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      textures: [],
      components: [],
      children: [],
    };
    const convertObject = vi.fn(
      (obj: UdonariumObject): ResoniteObject => ({
        id: `slot-${obj.id}`,
        name: obj.name,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        textures: [],
        components: [],
        children: [],
      })
    );

    const result = convertCardStack(
      udonObj,
      resoniteObj,
      convertObject,
      new Map<string, number>([['front.png', 2]])
    );

    expect(result.position).toEqual({ x: 1, y: 0.001, z: -2 });
    expect(result.components[0]).toEqual({
      id: 'slot-stack-2-collider',
      type: '[FrooxEngine]FrooxEngine.BoxCollider',
      fields: {
        Size: { $type: 'float3', value: { x: 2, y: 0.05, z: 4 } },
      },
    });
  });

  it('uses back image aspect ratio for face-down top card', () => {
    const card: Card = {
      id: 'card-a',
      type: 'card',
      name: 'A',
      position: { x: 0, y: 0, z: 0 },
      images: [
        { identifier: './assets/images/trump/c01.gif', name: 'front' },
        { identifier: 'testCharacter_1_image', name: 'back' },
      ],
      properties: new Map(),
      size: 2,
      isFaceUp: false,
      frontImage: { identifier: './assets/images/trump/c01.gif', name: 'front' },
      backImage: { identifier: 'testCharacter_1_image', name: 'back' },
    };
    const udonObj: CardStack = {
      id: 'stack-3',
      type: 'card-stack',
      name: 'Stack',
      position: { x: 0, y: 0, z: 0 },
      images: [],
      properties: new Map(),
      cards: [card],
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-stack-3',
      name: 'Stack',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      textures: [],
      components: [],
      children: [],
    };
    const convertObject = vi.fn(
      (obj: UdonariumObject): ResoniteObject => ({
        id: `slot-${obj.id}`,
        name: obj.name,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        textures: [],
        components: [],
        children: [],
      })
    );

    const result = convertCardStack(
      udonObj,
      resoniteObj,
      convertObject,
      new Map<string, number>([
        ['./assets/images/trump/c01.gif', 1.5],
        ['testCharacter_1_image', 1.2],
      ])
    );

    expect(result.position).toEqual({ x: 1, y: 0.001, z: -1.2 });
    expect(result.components[0]).toEqual({
      id: 'slot-stack-3-collider',
      type: '[FrooxEngine]FrooxEngine.BoxCollider',
      fields: {
        Size: { $type: 'float3', value: { x: 2, y: 0.05, z: 2.4 } },
      },
    });
  });
});
