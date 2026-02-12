import { describe, expect, it } from 'vitest';
import { ResoniteObject } from './ResoniteObject';
import {
  prepareSharedMaterialDefinitions,
  resolveSharedMaterialReferences,
} from './sharedMaterial';

function createObject(id: string): ResoniteObject {
  return {
    id,
    name: id,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    textures: [],
    components: [
      {
        id: `${id}-mat`,
        type: '[FrooxEngine]FrooxEngine.XiexeToonMaterial',
        fields: {
          BlendMode: { $type: 'enum', value: 'Cutout', enumType: 'BlendMode' },
        },
      },
      {
        id: `${id}-renderer`,
        type: '[FrooxEngine]FrooxEngine.MeshRenderer',
        fields: {
          Mesh: { $type: 'reference', targetId: `${id}-mesh` },
          Materials: {
            $type: 'list',
            elements: [{ $type: 'reference', targetId: `${id}-mat` }],
          },
        },
      },
    ],
    children: [],
  };
}

describe('sharedMaterial', () => {
  it('deduplicates xiexe toon materials by settings', () => {
    const objects: ResoniteObject[] = [createObject('a'), createObject('b')];

    const definitions = prepareSharedMaterialDefinitions(objects);

    expect(definitions).toHaveLength(1);
    expect(definitions[0].componentType).toBe('[FrooxEngine]FrooxEngine.XiexeToonMaterial');
    expect(
      objects
        .flatMap((obj) => obj.components)
        .find((component) => component.type.endsWith('Material'))
    ).toBeUndefined();
  });

  it('replaces material placeholders with shared material component ids', () => {
    const objects: ResoniteObject[] = [createObject('a')];
    const definitions = prepareSharedMaterialDefinitions(objects);

    resolveSharedMaterialReferences(
      objects,
      new Map<string, string>([[definitions[0].key, 'shared-mat-id']])
    );

    const renderer = objects[0].components.find(
      (component) => component.type === '[FrooxEngine]FrooxEngine.MeshRenderer'
    );
    expect(renderer?.fields.Materials).toEqual({
      $type: 'list',
      elements: [{ $type: 'reference', targetId: 'shared-mat-id' }],
    });
  });
});
