import { describe, expect, it } from 'vitest';
import { ResoniteObject } from '../domain/ResoniteObject';
import { prepareSharedMeshDefinitions, resolveSharedMeshReferences } from './sharedMesh';

function createObject(
  id: string,
  meshType: '[FrooxEngine]FrooxEngine.BoxMesh' | '[FrooxEngine]FrooxEngine.QuadMesh',
  size: Record<string, number>
): ResoniteObject {
  return {
    id,
    name: id,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    components: [
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
        type: '[FrooxEngine]FrooxEngine.MeshRenderer',
        fields: {
          Mesh: { $type: 'reference', targetId: `${id}-mesh` },
          Materials: { $type: 'list', elements: [] },
        },
      },
    ],
    children: [],
    isActive: true,
  };
}

describe('sharedMesh', () => {
  it('deduplicates meshes by mesh type and size', () => {
    const objects: ResoniteObject[] = [
      createObject('box-a', '[FrooxEngine]FrooxEngine.BoxMesh', { x: 1, y: 1, z: 1 }),
      createObject('box-b', '[FrooxEngine]FrooxEngine.BoxMesh', { x: 1, y: 1, z: 1 }),
      createObject('quad-a', '[FrooxEngine]FrooxEngine.QuadMesh', { x: 2, y: 3 }),
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

  it('replaces mesh placeholders with created shared mesh component ids', () => {
    const objects: ResoniteObject[] = [
      createObject('quad-a', '[FrooxEngine]FrooxEngine.QuadMesh', { x: 4, y: 5 }),
    ];

    const definitions = prepareSharedMeshDefinitions(objects);
    resolveSharedMeshReferences(
      objects,
      new Map<string, string>([[definitions[0].key, 'shared-quad-mesh-component']])
    );

    const renderer = objects[0].components.find(
      (component) => component.type === '[FrooxEngine]FrooxEngine.MeshRenderer'
    );
    expect(renderer?.fields.Mesh).toEqual({
      $type: 'reference',
      targetId: 'shared-quad-mesh-component',
    });
  });
});
