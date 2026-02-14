import { describe, expect, it } from 'vitest';
import { applyCardConversion } from './cardConverter';
import { Card } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';

describe('applyCardConversion', () => {
  const createBaseCard = (): Card => ({
    id: 'card-1',
    type: 'card',
    name: 'Card',
    position: { x: 0, y: 0, z: 0 },
    images: [{ identifier: 'front.png', name: 'front.png' }],
    properties: new Map(),
    isFaceUp: true,
    frontImage: { identifier: 'front.png', name: 'front.png' },
    backImage: { identifier: 'back.png', name: 'back.png' },
  });

  const createBaseResonite = (): ResoniteObject => ({
    id: 'slot-card-1',
    name: 'Card',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    textures: ['front.png', 'back.png'],
    components: [],
    children: [],
  });

  it('creates collider + grabbable on parent and two card faces as children', () => {
    const udonObj = createBaseCard();
    const resoniteObj = createBaseResonite();

    applyCardConversion(udonObj, resoniteObj);

    expect(resoniteObj.position).toEqual({ x: 0.5, y: 0.001, z: -0.75 });
    expect(resoniteObj.rotation).toEqual({ x: 90, y: 0, z: 0 });
    expect(resoniteObj.components.map((c) => c.type)).toEqual([
      '[FrooxEngine]FrooxEngine.BoxCollider',
      '[FrooxEngine]FrooxEngine.Grabbable',
    ]);
    expect(resoniteObj.children).toHaveLength(2);
    expect(resoniteObj.children.map((c) => c.id)).toEqual([
      'slot-card-1-front',
      'slot-card-1-back',
    ]);
  });

  it('scales card width by size and keeps 1:1.5 aspect ratio', () => {
    const udonObj = createBaseCard();
    udonObj.size = 2;
    const resoniteObj = createBaseResonite();

    applyCardConversion(udonObj, resoniteObj);

    expect(resoniteObj.position).toEqual({ x: 1, y: 0.001, z: -1.5 });
    const collider = resoniteObj.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.BoxCollider'
    );
    expect(collider?.fields).toEqual({
      Size: { $type: 'float3', value: { x: 2, y: 3, z: 0.01 } },
    });

    const frontQuad = resoniteObj.children[0].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.QuadMesh'
    );
    const backQuad = resoniteObj.children[1].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.QuadMesh'
    );
    expect(frontQuad?.fields).toEqual({ Size: { $type: 'float2', value: { x: 2, y: 3 } } });
    expect(backQuad?.fields).toEqual({ Size: { $type: 'float2', value: { x: 2, y: 3 } } });
  });

  it('uses frontImage on front face and backImage on back face', () => {
    const udonObj = createBaseCard();
    const resoniteObj = createBaseResonite();

    applyCardConversion(udonObj, resoniteObj);

    const frontTexture = resoniteObj.children[0].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.StaticTexture2D'
    );
    const backTexture = resoniteObj.children[1].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.StaticTexture2D'
    );
    expect(frontTexture?.fields).toEqual({
      URL: { $type: 'Uri', value: 'texture://front.png' },
      WrapModeU: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
      WrapModeV: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
    });
    expect(backTexture?.fields).toEqual({
      URL: { $type: 'Uri', value: 'texture://back.png' },
      WrapModeU: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
      WrapModeV: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
    });
  });

  it('flips orientation when isFaceUp is false', () => {
    const udonObj = createBaseCard();
    udonObj.isFaceUp = false;
    const resoniteObj = createBaseResonite();

    applyCardConversion(udonObj, resoniteObj);

    expect(resoniteObj.rotation).toEqual({ x: -90, y: 0, z: 0 });
  });

  it('falls back textures when one or both sides are missing', () => {
    const udonObj = createBaseCard();
    udonObj.frontImage = null;
    udonObj.backImage = null;
    udonObj.images = [{ identifier: 'fallback.png', name: 'fallback.png' }];
    const resoniteObj = createBaseResonite();

    applyCardConversion(udonObj, resoniteObj);

    const frontTexture = resoniteObj.children[0].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.StaticTexture2D'
    );
    const backTexture = resoniteObj.children[1].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.StaticTexture2D'
    );
    expect(frontTexture?.fields).toEqual({
      URL: { $type: 'Uri', value: 'texture://fallback.png' },
      WrapModeU: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
      WrapModeV: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
    });
    expect(backTexture?.fields).toEqual({
      URL: { $type: 'Uri', value: 'texture://fallback.png' },
      WrapModeU: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
      WrapModeV: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
    });
  });

  it('applies point filter for GIF textures', () => {
    const udonObj = createBaseCard();
    udonObj.frontImage = { identifier: 'front.gif', name: 'front.gif' };
    udonObj.images = [{ identifier: 'front.gif', name: 'front.gif' }];
    const resoniteObj = createBaseResonite();

    applyCardConversion(udonObj, resoniteObj);

    const frontTexture = resoniteObj.children[0].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.StaticTexture2D'
    );
    expect(frontTexture?.fields).toEqual({
      URL: { $type: 'Uri', value: 'texture://front.gif' },
      WrapModeU: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
      WrapModeV: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
      FilterMode: { $type: 'enum?', value: 'Point', enumType: 'TextureFilterMode' },
    });
  });
});
