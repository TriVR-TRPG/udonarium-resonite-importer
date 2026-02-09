import { describe, expect, it } from 'vitest';
import { applyCardConversion } from './cardConverter';
import { Card } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';

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
    scale: { x: 1, y: 1, z: 1 },
    textures: ['front.png', 'back.png'],
    components: [],
    children: [],
  });

  it('カードサイズと両面Quad構成を設定する', () => {
    const udonObj = createBaseCard();
    const resoniteObj = createBaseResonite();

    applyCardConversion(udonObj, resoniteObj);

    expect(resoniteObj.rotation).toEqual({ x: 90, y: 0, z: 0 });
    expect(resoniteObj.scale).toEqual({ x: 1, y: 1, z: 1 });
    expect(resoniteObj.components[0].fields).toEqual({
      Size: { $type: 'float2', value: { x: 0.6, y: 0.9 } },
      DualSided: { $type: 'bool', value: true },
    });
  });

  it('表向きカードではfrontImageを使う', () => {
    const udonObj = createBaseCard();
    const resoniteObj = createBaseResonite();

    applyCardConversion(udonObj, resoniteObj);

    const textureComponent = resoniteObj.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.StaticTexture2D'
    );
    expect(textureComponent?.fields).toEqual({
      URL: { $type: 'Uri', value: 'texture://front.png' },
    });
  });

  it('裏向きカードではbackImageを使う', () => {
    const udonObj = createBaseCard();
    udonObj.isFaceUp = false;
    const resoniteObj = createBaseResonite();

    applyCardConversion(udonObj, resoniteObj);

    const textureComponent = resoniteObj.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.StaticTexture2D'
    );
    expect(textureComponent?.fields).toEqual({
      URL: { $type: 'Uri', value: 'texture://back.png' },
    });
  });

  it('片面しかない場合は存在する側の画像を使う', () => {
    const udonObj = createBaseCard();
    udonObj.isFaceUp = false;
    udonObj.backImage = null;
    const resoniteObj = createBaseResonite();

    applyCardConversion(udonObj, resoniteObj);

    const textureComponent = resoniteObj.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.StaticTexture2D'
    );
    expect(textureComponent?.fields).toEqual({
      URL: { $type: 'Uri', value: 'texture://front.png' },
    });
  });

  it('front/backともにない場合はimages配列へフォールバックする', () => {
    const udonObj = createBaseCard();
    udonObj.isFaceUp = false;
    udonObj.frontImage = null;
    udonObj.backImage = null;
    udonObj.images = [{ identifier: 'fallback.png', name: 'fallback.png' }];
    const resoniteObj = createBaseResonite();

    applyCardConversion(udonObj, resoniteObj);

    const textureComponent = resoniteObj.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.StaticTexture2D'
    );
    expect(textureComponent?.fields).toEqual({
      URL: { $type: 'Uri', value: 'texture://fallback.png' },
    });
  });

  it('GIFテクスチャではFilterModeをPointに設定する', () => {
    const udonObj = createBaseCard();
    udonObj.frontImage = { identifier: 'front.gif', name: 'front.gif' };
    udonObj.images = [{ identifier: 'front.gif', name: 'front.gif' }];
    const resoniteObj = createBaseResonite();
    resoniteObj.textures = ['front.gif', 'back.png'];

    applyCardConversion(udonObj, resoniteObj);

    const textureComponent = resoniteObj.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.StaticTexture2D'
    );
    expect(textureComponent?.fields).toEqual({
      URL: { $type: 'Uri', value: 'texture://front.gif' },
      FilterMode: { $type: 'enum?', value: 'Point', enumType: 'TextureFilterMode' },
    });
  });
});
