import { describe, expect, it, vi } from 'vitest';
import { applyCardStackConversion } from './cardStackConverter';
import { Card, CardStack, UdonariumObject } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';

describe('applyCardStackConversion', () => {
  it('子カードをchildrenへ展開し、高さオフセットを設定する', () => {
    const cardA: Card = {
      id: 'card-a',
      type: 'card',
      name: 'A',
      position: { x: 1, y: 2, z: 0 },
      images: [],
      properties: new Map(),
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

    applyCardStackConversion(udonObj, resoniteObj, convertObject);

    expect(convertObject).toHaveBeenCalledTimes(2);
    expect(resoniteObj.components).toEqual([
      {
        id: 'slot-stack-1-collider',
        type: '[FrooxEngine]FrooxEngine.BoxCollider',
        fields: {
          Size: { $type: 'float3', value: { x: 0.6, y: 0.05, z: 0.9 } },
        },
      },
    ]);
    expect(resoniteObj.position).toEqual({ x: 0.3, y: 0, z: -0.45 });
    expect(resoniteObj.children).toHaveLength(2);
    expect(resoniteObj.children[0].position).toEqual({ x: 0, y: 0, z: 0 });
    expect(resoniteObj.children[1].position).toEqual({ x: 0, y: 0.0005, z: 0 });
  });
});
