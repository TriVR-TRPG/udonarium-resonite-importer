import { describe, expect, it } from 'vitest';
import { applyTerrainConversion } from './terrainConverter';
import { Terrain } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';

describe('applyTerrainConversion', () => {
  it('terrain (unlocked) has BoxCollider + Grabbable and creates five QuadMesh faces', () => {
    const udonObj: Terrain = {
      id: 'terrain-1',
      type: 'terrain',
      isLocked: false,
      mode: 3,
      rotate: 0,
      locationName: 'table',
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
      '[FrooxEngine]FrooxEngine.Grabbable',
    ]);
    expect(resoniteObj.components[0].fields).toEqual({
      Size: {
        $type: 'float3',
        value: {
          x: 10,
          y: 2,
          z: 4,
        },
      },
    });
    expect(resoniteObj.position.x).toBe(5);
    expect(resoniteObj.position.y).toBe(1);
    expect(resoniteObj.position.z).toBe(-2);

    expect(resoniteObj.children).toHaveLength(2);
    const topFace = resoniteObj.children.find((child) => child.id === 'slot-terrain-1-top');
    expect(topFace).toBeDefined();
    expect(topFace?.components.map((c) => c.type)).toEqual([
      '[FrooxEngine]FrooxEngine.QuadMesh',
      '[FrooxEngine]FrooxEngine.StaticTexture2D',
      '[FrooxEngine]FrooxEngine.UnlitMaterial',
      '[FrooxEngine]FrooxEngine.MeshRenderer',
    ]);

    const wallsSlot = resoniteObj.children.find((child) => child.id === 'slot-terrain-1-walls');
    expect(wallsSlot).toBeDefined();
    expect(wallsSlot?.isActive).toBe(true);
    expect(wallsSlot?.children).toHaveLength(4);
    for (const wallFace of wallsSlot?.children ?? []) {
      expect(wallFace.components.map((c) => c.type)).toEqual([
        '[FrooxEngine]FrooxEngine.QuadMesh',
        '[FrooxEngine]FrooxEngine.StaticTexture2D',
        '[FrooxEngine]FrooxEngine.UnlitMaterial',
        '[FrooxEngine]FrooxEngine.MeshRenderer',
      ]);
    }

    expect(topFace?.position).toEqual({ x: 0, y: 1, z: 0 });
    expect(topFace?.rotation).toEqual({ x: 90, y: 0, z: 0 });
    expect(topFace?.components[0].fields).toEqual({
      Size: { $type: 'float2', value: { x: 10, y: 4 } },
    });

    const frontFace = wallsSlot?.children.find(
      (child) => child.id === 'slot-terrain-1-walls-front'
    );
    expect(frontFace?.position).toEqual({ x: 0, y: 0, z: -2 });
    expect(frontFace?.components[0].fields).toEqual({
      Size: { $type: 'float2', value: { x: 10, y: 2 } },
    });

    const leftFace = wallsSlot?.children.find((child) => child.id === 'slot-terrain-1-walls-left');
    expect(leftFace?.position).toEqual({ x: -5, y: 0, z: 0 });
    expect(leftFace?.components[0].fields).toEqual({
      Size: { $type: 'float2', value: { x: 4, y: 2 } },
    });
  });

  it('terrain (locked) does not add Grabbable', () => {
    const udonObj: Terrain = {
      id: 'terrain-2',
      type: 'terrain',
      isLocked: true,
      mode: 3,
      rotate: 0,
      locationName: 'table',
      name: 'Locked Terrain',
      position: { x: 0, y: 0, z: 0 },
      images: [],
      properties: new Map(),
      width: 2,
      height: 2,
      depth: 2,
      wallImage: null,
      floorImage: null,
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-terrain-2',
      name: 'Locked Terrain',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      textures: [],
      components: [],
      children: [],
    };

    applyTerrainConversion(udonObj, resoniteObj);

    expect(resoniteObj.components.map((c) => c.type)).toEqual([
      '[FrooxEngine]FrooxEngine.BoxCollider',
    ]);
  });

  it('terrain mode=1 creates walls slot and deactivates it', () => {
    const udonObj: Terrain = {
      id: 'terrain-3',
      type: 'terrain',
      isLocked: false,
      mode: 1,
      rotate: 0,
      locationName: 'table',
      name: 'No Walls Terrain',
      position: { x: 0, y: 0, z: 0 },
      images: [{ identifier: 'wall.png', name: 'wall.png' }],
      properties: new Map(),
      width: 6,
      height: 2,
      depth: 4,
      wallImage: { identifier: 'wall.png', name: 'wall.png' },
      floorImage: { identifier: 'floor.png', name: 'floor.png' },
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-terrain-3',
      name: 'No Walls Terrain',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      textures: ['wall.png', 'floor.png'],
      components: [],
      children: [],
    };

    applyTerrainConversion(udonObj, resoniteObj);

    expect(resoniteObj.children).toHaveLength(2);
    expect(resoniteObj.children[0].id).toBe('slot-terrain-3-top');
    expect(resoniteObj.children[0].components.map((c) => c.type)).toEqual([
      '[FrooxEngine]FrooxEngine.QuadMesh',
      '[FrooxEngine]FrooxEngine.StaticTexture2D',
      '[FrooxEngine]FrooxEngine.UnlitMaterial',
      '[FrooxEngine]FrooxEngine.MeshRenderer',
    ]);
    expect(resoniteObj.children[1].id).toBe('slot-terrain-3-walls');
    expect(resoniteObj.children[1].isActive).toBe(false);
    expect(resoniteObj.children[1].children).toHaveLength(4);
  });
});
