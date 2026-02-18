import { describe, expect, it } from 'vitest';
import { convertTerrain } from './terrainConverter';
import { Terrain } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';

describe('convertTerrain', () => {
  it('terrain (unlocked) has BoxCollider + Grabbable and creates five QuadMesh faces', () => {
    const udonObj: Terrain = {
      id: 'terrain-1',
      type: 'terrain',
      isLocked: false,
      mode: 3,
      rotate: 0,
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
      components: [],
      children: [],
      isActive: true,
    };

    const result = convertTerrain(
      udonObj,
      resoniteObj.position,
      undefined,
      undefined,
      resoniteObj.id
    );

    expect(result.components.map((c) => c.type)).toEqual([
      '[FrooxEngine]FrooxEngine.BoxCollider',
      '[FrooxEngine]FrooxEngine.Grabbable',
    ]);
    expect(result.components[0].fields).toEqual({
      Size: {
        $type: 'float3',
        value: {
          x: 10,
          y: 2,
          z: 4,
        },
      },
    });
    expect(result.position.x).toBe(5);
    expect(result.position.y).toBe(1);
    expect(result.position.z).toBe(-2);

    expect(result.children).toHaveLength(2);
    const topFace = result.children.find((child) => child.id === 'slot-terrain-1-top');
    expect(topFace).toBeDefined();
    expect(topFace?.components.map((c) => c.type)).toEqual([
      '[FrooxEngine]FrooxEngine.QuadMesh',
      '[FrooxEngine]FrooxEngine.StaticTexture2D',
      '[FrooxEngine]FrooxEngine.XiexeToonMaterial',
      '[FrooxEngine]FrooxEngine.MainTexturePropertyBlock',
      '[FrooxEngine]FrooxEngine.MeshRenderer',
    ]);

    const wallsSlot = result.children.find((child) => child.id === 'slot-terrain-1-walls');
    expect(wallsSlot).toBeDefined();
    expect(wallsSlot?.isActive).toBe(true);
    expect(wallsSlot?.children).toHaveLength(4);
    for (const wallFace of wallsSlot?.children ?? []) {
      expect(wallFace.components.map((c) => c.type)).toEqual([
        '[FrooxEngine]FrooxEngine.QuadMesh',
        '[FrooxEngine]FrooxEngine.StaticTexture2D',
        '[FrooxEngine]FrooxEngine.XiexeToonMaterial',
        '[FrooxEngine]FrooxEngine.MainTexturePropertyBlock',
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

  it('terrain (locked) does not add Grabbable and enables CharacterCollider', () => {
    const udonObj: Terrain = {
      id: 'terrain-2',
      type: 'terrain',
      isLocked: true,
      mode: 3,
      rotate: 0,
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
      components: [],
      children: [],
      isActive: true,
    };

    const result = convertTerrain(
      udonObj,
      resoniteObj.position,
      undefined,
      undefined,
      resoniteObj.id
    );

    expect(result.components.map((c) => c.type)).toEqual(['[FrooxEngine]FrooxEngine.BoxCollider']);
    expect(result.components[0].fields).toEqual({
      Size: {
        $type: 'float3',
        value: {
          x: 2,
          y: 2,
          z: 2,
        },
      },
      CharacterCollider: {
        $type: 'bool',
        value: true,
      },
    });
  });

  it('terrain (locked) does not add CharacterCollider when option is disabled', () => {
    const udonObj: Terrain = {
      id: 'terrain-2-no-character-collider',
      type: 'terrain',
      isLocked: true,
      mode: 3,
      rotate: 0,
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

    const result = convertTerrain(
      udonObj,
      { x: 0, y: 0, z: 0 },
      undefined,
      undefined,
      'slot-terrain-2-no-character-collider',
      { enableCharacterColliderOnLockedTerrain: false }
    );

    expect(result.components.map((c) => c.type)).toEqual(['[FrooxEngine]FrooxEngine.BoxCollider']);
    expect(result.components[0].fields).toEqual({
      Size: {
        $type: 'float3',
        value: {
          x: 2,
          y: 2,
          z: 2,
        },
      },
    });
  });

  it('terrain mode=1 creates walls slot and deactivates it', () => {
    const udonObj: Terrain = {
      id: 'terrain-3',
      type: 'terrain',
      isLocked: false,
      mode: 1,
      rotate: 0,
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
      components: [],
      children: [],
      isActive: true,
    };

    const result = convertTerrain(
      udonObj,
      resoniteObj.position,
      undefined,
      undefined,
      resoniteObj.id
    );

    expect(result.children).toHaveLength(2);
    expect(result.children[0].id).toBe('slot-terrain-3-top');
    expect(result.children[0].components.map((c) => c.type)).toEqual([
      '[FrooxEngine]FrooxEngine.QuadMesh',
      '[FrooxEngine]FrooxEngine.StaticTexture2D',
      '[FrooxEngine]FrooxEngine.XiexeToonMaterial',
      '[FrooxEngine]FrooxEngine.MainTexturePropertyBlock',
      '[FrooxEngine]FrooxEngine.MeshRenderer',
    ]);
    expect(result.children[1].id).toBe('slot-terrain-3-walls');
    expect(result.children[1].isActive).toBe(false);
    expect(result.children[1].children).toHaveLength(4);
  });

  it('terrain rotate maps to Resonite Y rotation and keeps edge-to-center offset', () => {
    const udonObj: Terrain = {
      id: 'terrain-rotate',
      type: 'terrain',
      isLocked: false,
      mode: 3,
      rotate: 30,
      name: 'Terrain Rotate',
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
      id: 'slot-terrain-rotate',
      name: 'Terrain Rotate',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      components: [],
      children: [],
      isActive: true,
    };

    const result = convertTerrain(
      udonObj,
      resoniteObj.position,
      undefined,
      undefined,
      resoniteObj.id
    );

    expect(result.position).toEqual({ x: 1, y: 1, z: -1 });
    expect(result.rotation).toEqual({ x: 0, y: 30, z: 0 });
  });
});
