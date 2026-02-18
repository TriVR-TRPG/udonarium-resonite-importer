import { describe, expect, it } from 'vitest';
import { DiceSymbol } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';
import { convertDiceSymbol } from './diceSymbolConverter';

function createBaseDice(): DiceSymbol {
  return {
    id: 'dice-1',
    type: 'dice-symbol',
    name: 'D6',
    position: { x: 0, y: 0, z: 0 },
    images: [
      { identifier: 'face-1.png', name: '1' },
      { identifier: 'face-2.png', name: '2' },
    ],
    faceImages: [
      { identifier: 'face-1.png', name: '1' },
      { identifier: 'face-2.png', name: '2' },
    ],
    properties: new Map(),
    size: 2,
    face: '2',
    rotate: 0,
  };
}

function createBaseResonite(): ResoniteObject {
  return {
    id: 'slot-dice-1',
    name: 'D6',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    components: [],
    children: [],
  };
}

describe('convertDiceSymbol', () => {
  it('adds parent collider + grabbable and enables only active face child', () => {
    const udonObj = createBaseDice();
    const resoniteObj = createBaseResonite();

    const result = convertDiceSymbol(udonObj, resoniteObj, (size) => ({
      x: size,
      y: size,
      z: size,
    }));

    expect(result.components.map((c) => c.type)).toEqual([
      '[FrooxEngine]FrooxEngine.BoxCollider',
      '[FrooxEngine]FrooxEngine.Grabbable',
    ]);
    expect(result.components[0].fields).toEqual({
      Size: { $type: 'float3', value: { x: 2, y: 2, z: 0.05 } },
    });
    expect(result.children).toHaveLength(2);
    expect(result.children.map((c) => c.isActive)).toEqual([false, true]);
    expect(result.position).toEqual({ x: 1, y: 1, z: -1 });
  });

  it('uses per-face aspect ratio and bottom-aligns to the largest face', () => {
    const udonObj = createBaseDice();
    const resoniteObj = createBaseResonite();
    const imageAspectRatioMap = new Map<string, number>([
      ['face-1.png', 1],
      ['face-2.png', 2],
    ]);

    const result = convertDiceSymbol(
      udonObj,
      resoniteObj,
      (size) => ({ x: size, y: size, z: size }),
      undefined,
      imageAspectRatioMap
    );

    expect(result.components[0].fields).toEqual({
      Size: { $type: 'float3', value: { x: 2, y: 4, z: 0.05 } },
    });
    expect(result.position).toEqual({ x: 1, y: 2, z: -1 });

    const firstQuad = result.children[0].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.QuadMesh'
    );
    const secondQuad = result.children[1].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.QuadMesh'
    );
    expect(firstQuad?.fields.Size).toEqual({ $type: 'float2', value: { x: 2, y: 2 } });
    expect(secondQuad?.fields.Size).toEqual({ $type: 'float2', value: { x: 2, y: 4 } });

    const firstBottom = result.children[0].position.y - 1;
    const secondBottom = result.children[1].position.y - 2;
    expect(firstBottom).toBeCloseTo(-2);
    expect(secondBottom).toBeCloseTo(-2);
  });

  it('maps dice rotate to parent Y rotation', () => {
    const udonObj = createBaseDice();
    udonObj.rotate = -30;
    const resoniteObj = createBaseResonite();

    const result = convertDiceSymbol(udonObj, resoniteObj, (size) => ({
      x: size,
      y: size,
      z: size,
    }));

    expect(result.rotation).toEqual({ x: 0, y: -30, z: 0 });
  });
});
