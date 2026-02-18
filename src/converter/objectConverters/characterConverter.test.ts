import { describe, expect, it, vi } from 'vitest';
import { convertCharacter } from './characterConverter';
import { GameCharacter } from '../../domain/UdonariumObject';
import { ResoniteObject, Vector3 } from '../../domain/ResoniteObject';

describe('convertCharacter', () => {
  it('サイズ変換とQuad系コンポーネントを設定する', () => {
    const udonObj: GameCharacter = {
      id: 'char-1',
      type: 'character',
      name: 'Character',
      position: { x: 0, y: 0, z: 0 },
      images: [{ identifier: 'char.png', name: 'char.png' }],
      properties: new Map(),
      size: 3,
      rotate: 30,
      roll: 15,
      resources: [],
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-char-1',
      name: 'Character',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      textures: ['char.png'],
      components: [],
      children: [],
    };
    const converted: Vector3 = { x: 0.3, y: 0.3, z: 0.3 };
    const convertSize = vi.fn().mockReturnValue(converted);

    const result = convertCharacter(udonObj, resoniteObj, convertSize);

    expect(convertSize).toHaveBeenCalledWith(3);
    expect(result.components.map((c) => c.type)).toEqual([
      '[FrooxEngine]FrooxEngine.QuadMesh',
      '[FrooxEngine]FrooxEngine.StaticTexture2D',
      '[FrooxEngine]FrooxEngine.XiexeToonMaterial',
      '[FrooxEngine]FrooxEngine.MainTexturePropertyBlock',
      '[FrooxEngine]FrooxEngine.MeshRenderer',
      '[FrooxEngine]FrooxEngine.BoxCollider',
      '[FrooxEngine]FrooxEngine.Grabbable',
    ]);
    expect(result.components[0].fields).toEqual({
      Size: { $type: 'float2', value: { x: 0.3, y: 0.3 } },
      DualSided: { $type: 'bool', value: true },
    });
    expect(result.position.x).toBe(0.15);
    expect(result.position.z).toBe(-0.15);
    expect(result.position.y).toBe(0.15);
    expect(result.rotation).toEqual({ x: 0, y: 30, z: 15 });

    const materialComponent = result.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.XiexeToonMaterial'
    );
    expect(materialComponent?.fields).toEqual({
      BlendMode: { $type: 'enum', value: 'Opaque', enumType: 'BlendMode' },
      ShadowRamp: { $type: 'reference', targetId: null },
      ShadowSharpness: { $type: 'float', value: 0 },
    });
    const textureBlockComponent = result.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.MainTexturePropertyBlock'
    );
    expect(textureBlockComponent?.fields).toEqual({
      Texture: { $type: 'reference', targetId: 'slot-char-1-tex' },
    });
    expect(result.components[5].fields).toEqual({
      Size: { $type: 'float3', value: { x: 0.3, y: 0.3, z: 0.05 } },
    });
    expect(result.components[6].fields).toEqual({
      Scalable: { $type: 'bool', value: true },
    });
  });

  it('does not generate mesh components when character has no image', () => {
    const udonObj: GameCharacter = {
      id: 'char-no-image',
      type: 'character',
      name: 'No Image Character',
      position: { x: 0, y: 0, z: 0 },
      images: [],
      properties: new Map(),
      size: 2,
      resources: [],
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-char-no-image',
      name: 'No Image Character',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      textures: [],
      components: [],
      children: [],
    };
    const convertSize = vi.fn().mockReturnValue({ x: 1, y: 1, z: 1 });

    const result = convertCharacter(udonObj, resoniteObj, convertSize);

    expect(result.components.map((c) => c.type)).toEqual([
      '[FrooxEngine]FrooxEngine.BoxCollider',
      '[FrooxEngine]FrooxEngine.Grabbable',
    ]);
  });

  it('generates image mesh using image aspect ratio while keeping width at size', () => {
    const udonObj: GameCharacter = {
      id: 'char-ratio',
      type: 'character',
      name: 'Ratio Character',
      position: { x: 0, y: 0, z: 0 },
      images: [{ identifier: 'char-ratio.png', name: 'char-ratio.png' }],
      properties: new Map(),
      size: 1,
      resources: [],
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-char-ratio',
      name: 'Ratio Character',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      textures: ['char-ratio.png'],
      components: [],
      children: [],
    };
    const convertSize = vi.fn().mockReturnValue({ x: 1, y: 1, z: 1 });
    const imageAspectRatioMap = new Map<string, number>([['char-ratio.png', 2]]);

    const result = convertCharacter(
      udonObj,
      resoniteObj,
      convertSize,
      undefined,
      imageAspectRatioMap
    );

    const quad = result.components.find((c) => c.type === '[FrooxEngine]FrooxEngine.QuadMesh');
    expect(quad?.fields.Size).toEqual({ $type: 'float2', value: { x: 1, y: 2 } });
    const collider = result.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.BoxCollider'
    );
    expect(collider?.fields.Size).toEqual({ $type: 'float3', value: { x: 1, y: 2, z: 0.05 } });
    expect(result.position).toEqual({ x: 0.5, y: 1, z: -0.5 });
  });
});
