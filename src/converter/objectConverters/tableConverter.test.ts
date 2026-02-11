import { describe, expect, it } from 'vitest';
import { applyTableConversion } from './tableConverter';
import { GameTable, Terrain } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';

describe('applyTableConversion', () => {
  it('keeps the table container unrotated and builds visual quad as a child slot', () => {
    const childTerrain: Terrain = {
      id: 'terrain-1',
      type: 'terrain',
      name: 'Terrain',
      position: { x: 10, y: 20, z: 0 },
      images: [],
      properties: new Map(),
      width: 1,
      height: 1,
      depth: 1,
      wallImage: null,
      floorImage: null,
    };

    const udonObj: GameTable = {
      id: 'table-1',
      type: 'table',
      name: 'Table',
      position: { x: 0, y: 0, z: 0 },
      images: [{ identifier: 'table.png', name: 'table.png' }],
      properties: new Map(),
      width: 20,
      height: 10,
      gridType: 'square',
      gridColor: '#ffffff',
      children: [childTerrain],
    };

    const resoniteObj: ResoniteObject = {
      id: 'slot-table-1',
      name: 'Table',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      textures: ['table.png'],
      components: [],
      children: [],
    };

    const convertedTerrain: ResoniteObject = {
      id: 'slot-terrain-1',
      name: 'Terrain',
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 0, z: 0 },
      textures: [],
      components: [],
      children: [],
    };

    applyTableConversion(udonObj, resoniteObj, undefined, () => convertedTerrain);

    expect(resoniteObj.rotation).toEqual({ x: 0, y: 0, z: 0 });
    expect(resoniteObj.components).toEqual([]);
    expect(resoniteObj.children).toHaveLength(2);

    const visual = resoniteObj.children[0];
    expect(visual.position).toEqual({ x: 10, y: 0, z: -5 });
    expect(visual.rotation).toEqual({ x: 90, y: 0, z: 0 });
    // QuadMesh + MeshRenderer + Material + StaticTexture2D + BoxCollider
    const collider = visual.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.BoxCollider'
    );
    expect(collider).toBeDefined();
    expect(collider!.fields).toEqual({
      Size: { $type: 'float3', value: { x: 20, y: 10, z: 0.02 } },
    });
    expect(visual.components[0].fields).toEqual({
      Size: { $type: 'float2', value: { x: 20, y: 10 } },
    });

    expect(resoniteObj.children[1]).toBe(convertedTerrain);
  });
});
