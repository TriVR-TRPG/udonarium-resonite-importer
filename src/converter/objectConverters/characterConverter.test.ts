import { describe, expect, it, vi } from 'vitest';
import { applyCharacterConversion } from './characterConverter';
import { GameCharacter } from '../UdonariumObject';
import { ResoniteObject, Vector3 } from '../ResoniteObject';

describe('applyCharacterConversion', () => {
  it('サイズ変換とQuad系コンポーネントを設定する', () => {
    const udonObj: GameCharacter = {
      id: 'char-1',
      type: 'character',
      name: 'Character',
      position: { x: 0, y: 0, z: 0 },
      images: [{ identifier: 'char.png', name: 'char.png' }],
      properties: new Map(),
      size: 3,
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

    applyCharacterConversion(udonObj, resoniteObj, convertSize);

    expect(convertSize).toHaveBeenCalledWith(3);
    expect(resoniteObj.components.map((c) => c.type)).toEqual([
      '[FrooxEngine]FrooxEngine.QuadMesh',
      '[FrooxEngine]FrooxEngine.StaticTexture2D',
      '[FrooxEngine]FrooxEngine.XiexeToonMaterial',
      '[FrooxEngine]FrooxEngine.MainTexturePropertyBlock',
      '[FrooxEngine]FrooxEngine.MeshRenderer',
      '[FrooxEngine]FrooxEngine.BoxCollider',
    ]);
    expect(resoniteObj.components[0].fields).toEqual({
      Size: { $type: 'float2', value: { x: 0.3, y: 0.3 } },
      DualSided: { $type: 'bool', value: true },
    });
    expect(resoniteObj.position.x).toBe(0.15);
    expect(resoniteObj.position.z).toBe(-0.15);
    expect(resoniteObj.position.y).toBe(0.15);

    const materialComponent = resoniteObj.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.XiexeToonMaterial'
    );
    expect(materialComponent?.fields).toEqual({
      BlendMode: { $type: 'enum', value: 'Cutout', enumType: 'BlendMode' },
      ShadowRamp: { $type: 'reference', targetId: null },
      ShadowSharpness: { $type: 'float', value: 0 },
    });
    const textureBlockComponent = resoniteObj.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.MainTexturePropertyBlock'
    );
    expect(textureBlockComponent?.fields).toEqual({
      Texture: { $type: 'reference', targetId: 'slot-char-1-tex' },
    });
    expect(resoniteObj.components[5].fields).toEqual({
      Size: { $type: 'float3', value: { x: 0.3, y: 0.3, z: 0.05 } },
    });
  });
});
