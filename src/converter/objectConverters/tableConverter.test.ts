import { describe, expect, it } from 'vitest';
import { convertTable } from './tableConverter';
import { GameTable, Terrain } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';
import { COMPONENT_TYPES } from '../../config/ResoniteComponentTypes';
import { buildImageAssetContext } from '../imageAssetContext';

describe('convertTable', () => {
  it('keeps the table container unrotated and builds visual quad as a child slot', () => {
    const childTerrain: Terrain = {
      id: 'terrain-1',
      type: 'terrain',
      isLocked: false,
      mode: 3,
      rotate: 0,
      name: 'Terrain',
      position: { x: 10, y: 20, z: 0 },
      images: [],
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
      width: 20,
      height: 10,
      gridType: 'square',
      gridColor: '#ffffff',
      selected: false,
      children: [childTerrain],
    };

    const resoniteObj: ResoniteObject = {
      id: 'slot-table-1',
      name: 'Table',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      components: [],
      children: [],
      isActive: true,
    };

    const convertedTerrain: ResoniteObject = {
      id: 'slot-terrain-1',
      name: 'Terrain',
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 0, z: 0 },
      components: [],
      children: [],
      isActive: true,
    };

    const result = convertTable(
      udonObj,
      resoniteObj.position,
      buildImageAssetContext(),
      () => convertedTerrain,
      undefined,
      resoniteObj.id
    );

    expect(result.rotation).toEqual({ x: 0, y: 0, z: 0 });
    expect(result.components).toEqual([]);
    expect(result.children).toHaveLength(2);

    const visual = result.children[0];
    expect(visual.position).toEqual({ x: 10, y: 0, z: -5 });
    expect(visual.rotation).toEqual({ x: 90, y: 0, z: 0 });
    // QuadMesh + MeshRenderer + Material + StaticTexture2D + BoxCollider
    const collider = visual.components.find((c) => c.type === COMPONENT_TYPES.BOX_COLLIDER);
    expect(collider).toBeDefined();
    expect(collider!.fields).toEqual({
      Size: { $type: 'float3', value: { x: 20, y: 10, z: 0 } },
      CharacterCollider: { $type: 'bool', value: true },
    });
    expect(visual.components[0].fields).toEqual({
      Size: { $type: 'float2', value: { x: 20, y: 10 } },
    });
    const material = visual.components.find((c) => c.type === COMPONENT_TYPES.XIEXE_TOON_MATERIAL);
    expect(material?.fields.Culling).toEqual({
      $type: 'enum',
      value: 'Off',
      enumType: 'Culling',
    });

    expect(result.children[1]).toBe(convertedTerrain);
  });

  it('adds CharacterCollider to table visual collider when option is enabled', () => {
    const udonObj: GameTable = {
      id: 'table-2',
      type: 'table',
      name: 'Table',
      position: { x: 0, y: 0, z: 0 },
      images: [],
      width: 20,
      height: 10,
      gridType: 'square',
      gridColor: '#ffffff',
      selected: false,
      children: [],
    };

    const result = convertTable(
      udonObj,
      { x: 0, y: 0, z: 0 },
      buildImageAssetContext(),
      undefined,
      { enableCharacterColliderOnLockedTerrain: true },
      'slot-table-2'
    );
    const visual = result.children[0];
    const collider = visual.components.find((c) => c.type === COMPONENT_TYPES.BOX_COLLIDER);

    expect(collider).toBeDefined();
    expect(collider?.fields).toEqual({
      Size: { $type: 'float3', value: { x: 20, y: 10, z: 0 } },
      CharacterCollider: { $type: 'bool', value: true },
    });
  });
});
