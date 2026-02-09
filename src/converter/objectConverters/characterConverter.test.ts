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
      position: { x: 0, y: 0 },
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
      scale: { x: 1, y: 1, z: 1 },
      textures: ['char.png'],
      components: [],
      children: [],
    };
    const converted: Vector3 = { x: 0.3, y: 0.3, z: 0.3 };
    const convertSize = vi.fn().mockReturnValue(converted);

    applyCharacterConversion(udonObj, resoniteObj, convertSize);

    expect(convertSize).toHaveBeenCalledWith(3);
    expect(resoniteObj.scale).toEqual({ x: 1, y: 1, z: 1 });
    expect(resoniteObj.components.map((c) => c.type)).toEqual([
      '[FrooxEngine]FrooxEngine.QuadMesh',
      '[FrooxEngine]FrooxEngine.StaticTexture2D',
      '[FrooxEngine]FrooxEngine.UnlitMaterial',
      '[FrooxEngine]FrooxEngine.MeshRenderer',
    ]);
    expect(resoniteObj.components[0].fields).toEqual({
      Size: { $type: 'float2', value: { x: 0.3, y: 0.3 } },
      DualSided: { $type: 'bool', value: true },
    });

    const materialComponent = resoniteObj.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.UnlitMaterial'
    );
    expect(materialComponent?.fields).toEqual({
      Texture: { $type: 'reference', targetId: 'slot-char-1-tex' },
      BlendMode: { $type: 'enum', value: 'Cutout', enumType: 'BlendMode' },
    });
  });
});
