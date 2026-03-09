import { describe, expect, it } from 'vitest';
import { ResoniteObject } from '../domain/ResoniteObject';
import { prepareSharedMeshDefinitions, resolveSharedMeshReferences } from './sharedMesh';
import { COMPONENT_TYPES } from '../config/ResoniteComponentTypes';

function createObject(
  id: string,
  meshType: typeof COMPONENT_TYPES.BOX_MESH | typeof COMPONENT_TYPES.QUAD_MESH,
  size: Record<string, number>,
  options?: { colliderSize?: { x: number; y: number; z: number } }
): ResoniteObject {
  const components = [
    {
      id: `${id}-mesh`,
      type: meshType,
      fields: {
        Size: {
          $type: meshType.endsWith('BoxMesh') ? 'float3' : 'float2',
          value: size,
        },
      },
    },
    {
      id: `${id}-renderer`,
      type: COMPONENT_TYPES.MESH_RENDERER,
      fields: {
        Mesh: { $type: 'reference', targetId: `${id}-mesh` },
        Materials: { $type: 'list', elements: [] },
      },
    },
  ];

  if (options?.colliderSize) {
    components.push({
      id: `${id}-collider`,
      type: COMPONENT_TYPES.BOX_COLLIDER,
      fields: {
        Size: { $type: 'float3', value: options.colliderSize },
      },
    });
  }

  return {
    id,
    name: id,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    components,
    children: [],
    isActive: true,
  };
}

describe('sharedMesh', () => {
  it('deduplicates meshes by mesh type and size', () => {
    const objects: ResoniteObject[] = [
      createObject('box-a', COMPONENT_TYPES.BOX_MESH, { x: 1, y: 1, z: 1 }),
      createObject('box-b', COMPONENT_TYPES.BOX_MESH, { x: 1, y: 1, z: 1 }),
      createObject('quad-a', COMPONENT_TYPES.QUAD_MESH, { x: 2, y: 3 }),
    ];

    const definitions = prepareSharedMeshDefinitions(objects);

    expect(definitions).toHaveLength(2);
    expect(definitions.map((definition) => definition.name).sort()).toEqual([
      'BoxMesh_1x1x1',
      'QuadMesh_2x3',
    ]);

    expect(
      objects.flatMap((obj) => obj.components).find((component) => component.type.endsWith('Mesh'))
    ).toBeUndefined();
  });

  it('deduplicates meshes with same aspect ratio but different sizes', () => {
    const objects: ResoniteObject[] = [
      createObject('quad-a', COMPONENT_TYPES.QUAD_MESH, { x: 2, y: 3 }),
      createObject('quad-b', COMPONENT_TYPES.QUAD_MESH, { x: 4, y: 6 }),
    ];

    const definitions = prepareSharedMeshDefinitions(objects);

    expect(definitions).toHaveLength(1);
    expect(definitions[0].name).toBe('QuadMesh_2x3');
    expect(definitions[0].sizeValue).toEqual({ x: 2, y: 3 });
  });

  it('applies uniform scale to slot when mesh size differs from canonical', () => {
    const objects: ResoniteObject[] = [
      createObject('quad-a', COMPONENT_TYPES.QUAD_MESH, { x: 2, y: 3 }),
      createObject('quad-b', COMPONENT_TYPES.QUAD_MESH, { x: 4, y: 6 }),
    ];

    prepareSharedMeshDefinitions(objects);

    expect(objects[0].scale).toBeUndefined();
    expect(objects[1].scale).toEqual({ x: 2, y: 2, z: 2 });
  });

  it('applies uniform scale for box meshes with same proportions', () => {
    const objects: ResoniteObject[] = [
      createObject('box-a', COMPONENT_TYPES.BOX_MESH, { x: 1, y: 2, z: 3 }),
      createObject('box-b', COMPONENT_TYPES.BOX_MESH, { x: 3, y: 6, z: 9 }),
    ];

    const definitions = prepareSharedMeshDefinitions(objects);

    expect(definitions).toHaveLength(1);
    expect(definitions[0].sizeValue).toEqual({ x: 1, y: 2, z: 3 });
    expect(objects[1].scale).toEqual({ x: 3, y: 3, z: 3 });
  });

  it('does not merge meshes with different aspect ratios', () => {
    const objects: ResoniteObject[] = [
      createObject('quad-a', COMPONENT_TYPES.QUAD_MESH, { x: 2, y: 3 }),
      createObject('quad-b', COMPONENT_TYPES.QUAD_MESH, { x: 2, y: 5 }),
    ];

    const definitions = prepareSharedMeshDefinitions(objects);

    expect(definitions).toHaveLength(2);
    expect(objects[0].scale).toBeUndefined();
    expect(objects[1].scale).toBeUndefined();
  });

  it('composes uniform scale with existing slot scale', () => {
    const obj = createObject('quad-a', COMPONENT_TYPES.QUAD_MESH, { x: 2, y: 3 });
    const obj2 = createObject('quad-b', COMPONENT_TYPES.QUAD_MESH, { x: 4, y: 6 });
    (obj2 as { scale?: { x: number; y: number; z: number } }).scale = { x: -1, y: 1, z: 1 };

    prepareSharedMeshDefinitions([obj, obj2]);

    expect(obj2.scale).toEqual({ x: -2, y: 2, z: 2 });
  });

  it('adjusts collider sizes when applying uniform scale', () => {
    const objects: ResoniteObject[] = [
      createObject('quad-a', COMPONENT_TYPES.QUAD_MESH, { x: 2, y: 3 }),
      createObject(
        'quad-b',
        COMPONENT_TYPES.QUAD_MESH,
        { x: 4, y: 6 },
        {
          colliderSize: { x: 4, y: 6, z: 0.05 },
        }
      ),
    ];

    prepareSharedMeshDefinitions(objects);

    const collider = objects[1].components.find((c) => c.type === COMPONENT_TYPES.BOX_COLLIDER);
    expect(collider?.fields.Size).toEqual({
      $type: 'float3',
      value: { x: 2, y: 3, z: 0.025 },
    });
  });

  it('replaces mesh placeholders with created shared mesh component ids', () => {
    const objects: ResoniteObject[] = [
      createObject('quad-a', COMPONENT_TYPES.QUAD_MESH, { x: 4, y: 5 }),
    ];

    const definitions = prepareSharedMeshDefinitions(objects);
    resolveSharedMeshReferences(
      objects,
      new Map<string, string>([[definitions[0].key, 'shared-quad-mesh-component']])
    );

    const renderer = objects[0].components.find(
      (component) => component.type === COMPONENT_TYPES.MESH_RENDERER
    );
    expect(renderer?.fields.Mesh).toEqual({
      $type: 'reference',
      targetId: 'shared-quad-mesh-component',
    });
  });
});
