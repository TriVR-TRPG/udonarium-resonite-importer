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
    expect(resoniteObj.scale).toEqual(converted);
    expect(resoniteObj.components.map((c) => c.type)).toEqual([
      '[FrooxEngine]FrooxEngine.QuadMesh',
      '[FrooxEngine]FrooxEngine.StaticTexture2D',
      '[FrooxEngine]FrooxEngine.UnlitMaterial',
      '[FrooxEngine]FrooxEngine.MeshRenderer',
    ]);
  });
});
