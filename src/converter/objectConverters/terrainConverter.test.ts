import { describe, expect, it } from 'vitest';
import { applyTerrainConversion } from './terrainConverter';
import { Terrain } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';

describe('applyTerrainConversion', () => {
  it('terrain container has BoxCollider and creates five QuadMesh faces', () => {
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
      textures: ['wall.png', 'floor.png'],
      components: [],
      children: [],
    };

    applyTerrainConversion(udonObj, resoniteObj);

    expect(resoniteObj.components.map((c) => c.type)).toEqual([
      '[FrooxEngine]FrooxEngine.BoxCollider',
    ]);
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
    expect(resoniteObj.position.y).toBe(2);

    expect(resoniteObj.children).toHaveLength(5);
    for (const child of resoniteObj.children) {
      expect(child.components.map((c) => c.type)).toEqual([
        '[FrooxEngine]FrooxEngine.QuadMesh',
        '[FrooxEngine]FrooxEngine.StaticTexture2D',
        '[FrooxEngine]FrooxEngine.UnlitMaterial',
        '[FrooxEngine]FrooxEngine.MeshRenderer',
      ]);
    }

    const topFace = resoniteObj.children.find((child) => child.id === 'slot-terrain-1-top');
    expect(topFace?.position).toEqual({ x: 0, y: 2, z: 0 });
    expect(topFace?.rotation).toEqual({ x: 90, y: 0, z: 0 });
    expect(topFace?.components[0].fields).toEqual({
      Size: { $type: 'float2', value: { x: 10, y: 2 } },
    });

    const frontFace = resoniteObj.children.find((child) => child.id === 'slot-terrain-1-front');
    expect(frontFace?.position).toEqual({ x: 0, y: 0, z: -1 });
    expect(frontFace?.components[0].fields).toEqual({
      Size: { $type: 'float2', value: { x: 10, y: 4 } },
    });

    const leftFace = resoniteObj.children.find((child) => child.id === 'slot-terrain-1-left');
    expect(leftFace?.position).toEqual({ x: -5, y: 0, z: 0 });
    expect(leftFace?.components[0].fields).toEqual({
      Size: { $type: 'float2', value: { x: 2, y: 4 } },
    });
  });
});
