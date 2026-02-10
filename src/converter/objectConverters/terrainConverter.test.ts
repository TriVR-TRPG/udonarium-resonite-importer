import { describe, expect, it } from 'vitest';
import { applyTerrainConversion } from './terrainConverter';
import { Terrain } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';

describe('applyTerrainConversion', () => {
  it('地形サイズを反映し、Box系コンポーネントを設定する', () => {
    const udonObj: Terrain = {
      id: 'terrain-1',
      type: 'terrain',
      name: 'Terrain',
      position: { x: 0, y: 0, z: 0 },
      images: [{ identifier: 'wall.png', name: 'wall.png' }],
      properties: new Map(),
      width: 10,
      height: 2,
      depth: 4,
      wallImage: { identifier: 'wall.png', name: 'wall.png' },
      floorImage: { identifier: 'floor.png', name: 'floor.png' },
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-terrain-1',
      name: 'Terrain',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      textures: ['wall.png', 'floor.png'],
      components: [],
      children: [],
    };

    applyTerrainConversion(udonObj, resoniteObj);

    expect(resoniteObj.scale).toEqual({ x: 1, y: 1, z: 1 });
    expect(resoniteObj.components.map((c) => c.type)).toEqual([
      '[FrooxEngine]FrooxEngine.BoxMesh',
      '[FrooxEngine]FrooxEngine.StaticTexture2D',
      '[FrooxEngine]FrooxEngine.PBS_Metallic',
      '[FrooxEngine]FrooxEngine.MeshRenderer',
      '[FrooxEngine]FrooxEngine.BoxCollider',
    ]);
    // Udonarium height→Resonite Z, Udonarium depth→Resonite Y
    expect(resoniteObj.components[0].fields).toEqual({
      Size: {
        $type: 'float3',
        value: {
          x: 10,
          y: 4,
          z: 2,
        },
      },
    });
    // Bottom-origin offset: position.y += depth / 2
    expect(resoniteObj.position.y).toBe(2);

    const materialComponent = resoniteObj.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.PBS_Metallic'
    );
    expect(materialComponent?.fields).toEqual({
      AlbedoTexture: { $type: 'reference', targetId: 'slot-terrain-1-tex' },
      BlendMode: { $type: 'enum', value: 'Cutout', enumType: 'BlendMode' },
    });
    expect(resoniteObj.components[4].fields).toEqual({
      Size: {
        $type: 'float3',
        value: {
          x: 10,
          y: 4,
          z: 2,
        },
      },
    });
  });
});
