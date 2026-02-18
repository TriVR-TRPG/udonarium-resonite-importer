import { describe, expect, it } from 'vitest';
import { convertCard } from './cardConverter';
import { Card } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';

describe('convertCard', () => {
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
    components: [],
    children: [],
  });

  it('creates collider + grabbable on parent and two card faces as children', () => {
    const udonObj = createBaseCard();
    const resoniteObj = createBaseResonite();

    const result = convertCard(udonObj, resoniteObj);

    expect(result.position).toEqual({ x: 0.5, y: 0.001, z: -0.5 });
    expect(result.rotation).toEqual({ x: 0, y: 0, z: 0 });
    expect(result.components.map((c) => c.type)).toEqual([
      '[FrooxEngine]FrooxEngine.BoxCollider',
      '[FrooxEngine]FrooxEngine.Grabbable',
    ]);
    expect(result.children).toHaveLength(2);
    expect(result.children.map((c) => c.id)).toEqual(['slot-card-1-front', 'slot-card-1-back']);
    expect(result.children[0].rotation).toEqual({ x: 90, y: 0, z: 0 });
    expect(result.children[1].rotation).toEqual({ x: -90, y: 180, z: 0 });
  });

  it('scales card width by size and keeps 1:1 fallback aspect ratio', () => {
    const udonObj = createBaseCard();
    udonObj.size = 2;
    const resoniteObj = createBaseResonite();

    const result = convertCard(udonObj, resoniteObj);

    expect(result.position).toEqual({ x: 1, y: 0.001, z: -1 });
    const collider = result.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.BoxCollider'
    );
    expect(collider?.fields).toEqual({
      Size: { $type: 'float3', value: { x: 2, y: 0.01, z: 2 } },
    });

    const frontQuad = result.children[0].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.QuadMesh'
    );
    const backQuad = result.children[1].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.QuadMesh'
    );
    expect(frontQuad?.fields).toEqual({ Size: { $type: 'float2', value: { x: 2, y: 2 } } });
    expect(backQuad?.fields).toEqual({ Size: { $type: 'float2', value: { x: 2, y: 2 } } });
  });

  it('uses frontImage on front face and backImage on back face', () => {
    const udonObj = createBaseCard();
    const resoniteObj = createBaseResonite();

    const result = convertCard(udonObj, resoniteObj);

    const frontTexture = result.children[0].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.StaticTexture2D'
    );
    const backTexture = result.children[1].components.find(
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

  it('maps fixture-like back-rotated card to parent rotation (0, -30, 180)', () => {
    const udonObj = createBaseCard();
    udonObj.isFaceUp = false;
    udonObj.rotate = -30;
    const resoniteObj = createBaseResonite();

    const result = convertCard(udonObj, resoniteObj);

    expect(result.rotation).toEqual({ x: 0, y: -30, z: 180 });
  });

  it('falls back textures when one or both sides are missing', () => {
    const udonObj = createBaseCard();
    udonObj.frontImage = null;
    udonObj.backImage = null;
    udonObj.images = [{ identifier: 'fallback.png', name: 'fallback.png' }];
    const resoniteObj = createBaseResonite();

    const result = convertCard(udonObj, resoniteObj);

    const frontTexture = result.children[0].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.StaticTexture2D'
    );
    const backTexture = result.children[1].components.find(
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

    const result = convertCard(udonObj, resoniteObj);

    const frontTexture = result.children[0].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.StaticTexture2D'
    );
    expect(frontTexture?.fields).toEqual({
      URL: { $type: 'Uri', value: 'texture://front.gif' },
      WrapModeU: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
      WrapModeV: { $type: 'enum', value: 'Clamp', enumType: 'TextureWrapMode' },
      FilterMode: { $type: 'enum?', value: 'Point', enumType: 'TextureFilterMode' },
    });
  });

  it('uses image aspect ratio map to determine card height', () => {
    const udonObj = createBaseCard();
    udonObj.size = 2;
    const resoniteObj = createBaseResonite();
    const imageAspectRatioMap = new Map<string, number>([['front.png', 2]]);

    const result = convertCard(udonObj, resoniteObj, undefined, imageAspectRatioMap);

    expect(result.position).toEqual({ x: 1, y: 0.001, z: -2 });
    const collider = result.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.BoxCollider'
    );
    expect(collider?.fields).toEqual({
      Size: { $type: 'float3', value: { x: 2, y: 0.01, z: 4 } },
    });
  });

  it('falls back to back image aspect ratio when front is none_icon', () => {
    const udonObj = createBaseCard();
    udonObj.size = 2;
    udonObj.frontImage = { identifier: 'none_icon', name: 'front' };
    udonObj.backImage = { identifier: './assets/images/trump/z02.gif', name: 'back' };
    udonObj.images = [udonObj.frontImage, udonObj.backImage];
    const resoniteObj = createBaseResonite();
    const imageAspectRatioMap = new Map<string, number>([['assets/images/trump/z02.gif', 2]]);

    const result = convertCard(udonObj, resoniteObj, undefined, imageAspectRatioMap);

    expect(result.position).toEqual({ x: 1, y: 0.001, z: -2 });
  });

  it('uses per-face aspect ratios and parent uses larger height', () => {
    const udonObj = createBaseCard();
    udonObj.size = 2;
    udonObj.isFaceUp = false;
    udonObj.frontImage = { identifier: './assets/images/trump/c01.gif', name: 'front' };
    udonObj.backImage = { identifier: 'testCharacter_1_image', name: 'back' };
    udonObj.images = [udonObj.frontImage, udonObj.backImage];
    const resoniteObj = createBaseResonite();
    const imageAspectRatioMap = new Map<string, number>([
      ['./assets/images/trump/c01.gif', 1.1],
      ['testCharacter_1_image', 1.2],
    ]);

    const result = convertCard(udonObj, resoniteObj, undefined, imageAspectRatioMap);

    expect(result.position).toEqual({ x: 1, y: 0.001, z: -1.2 });
    const collider = result.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.BoxCollider'
    );
    expect(collider?.fields).toEqual({
      Size: { $type: 'float3', value: { x: 2, y: 0.01, z: 2.4 } },
    });
    const frontQuad = result.children[0].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.QuadMesh'
    );
    const backQuad = result.children[1].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.QuadMesh'
    );
    expect(result.children[0].position.x).toBe(0);
    expect(result.children[0].position.y).toBe(0.0001);
    expect(result.children[0].position.z).toBeCloseTo(0.1);
    expect(result.children[1].position).toEqual({ x: 0, y: -0.0001, z: 0 });
    expect(frontQuad?.fields).toEqual({ Size: { $type: 'float2', value: { x: 2, y: 2.2 } } });
    expect(backQuad?.fields).toEqual({ Size: { $type: 'float2', value: { x: 2, y: 2.4 } } });
  });

  it('switches blend mode by image alpha presence', () => {
    const udonObj = createBaseCard();
    const resoniteObj = createBaseResonite();
    const imageBlendModeMap = new Map([
      ['front.png', 'Opaque' as const],
      ['back.png', 'Alpha' as const],
    ]);

    const result = convertCard(udonObj, resoniteObj, undefined, undefined, imageBlendModeMap);

    const frontMaterial = result.children[0].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.XiexeToonMaterial'
    );
    const backMaterial = result.children[1].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.XiexeToonMaterial'
    );
    expect(frontMaterial?.fields.BlendMode).toEqual({
      $type: 'enum',
      value: 'Opaque',
      enumType: 'BlendMode',
    });
    expect(backMaterial?.fields.BlendMode).toEqual({
      $type: 'enum',
      value: 'Alpha',
      enumType: 'BlendMode',
    });
  });

  it('falls back to Cutout when blend mode is unresolved', () => {
    const udonObj = createBaseCard();
    const resoniteObj = createBaseResonite();
    const imageBlendModeMap = new Map([['back.png', 'Alpha' as const]]);

    const result = convertCard(udonObj, resoniteObj, undefined, undefined, imageBlendModeMap);

    const frontMaterial = result.children[0].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.XiexeToonMaterial'
    );
    expect(frontMaterial?.fields.BlendMode).toEqual({
      $type: 'enum',
      value: 'Cutout',
      enumType: 'BlendMode',
    });
  });
});
