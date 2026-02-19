import { describe, expect, it } from 'vitest';
import { ResoniteObject } from '../domain/ResoniteObject';
import {
  prepareSharedMaterialDefinitions,
  resolveSharedMaterialReferences,
} from './sharedMaterial';
import { COMPONENT_TYPES } from '../config/ResoniteComponentTypes';

function createObject(id: string): ResoniteObject {
  return {
    id,
    name: id,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    components: [
      {
        id: `${id}-mat`,
        type: COMPONENT_TYPES.XIEXE_TOON_MATERIAL,
        fields: {
          BlendMode: { $type: 'enum', value: 'Cutout', enumType: 'BlendMode' },
        },
      },
      {
        id: `${id}-renderer`,
        type: COMPONENT_TYPES.MESH_RENDERER,
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
    isActive: true,
  };
}

describe('sharedMaterial', () => {
  it('deduplicates xiexe toon materials by settings', () => {
    const objects: ResoniteObject[] = [createObject('a'), createObject('b')];

    const definitions = prepareSharedMaterialDefinitions(objects);

    expect(definitions).toHaveLength(1);
    expect(definitions[0].key).toBe('xiexe-toon:#FFFFFFFF:Cutout:Default');
    expect(definitions[0].name).toBe('XiexeToon_Cutout_Default_FFFFFFFF');
    expect(definitions[0].componentType).toBe(COMPONENT_TYPES.XIEXE_TOON_MATERIAL);
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
      (component) => component.type === COMPONENT_TYPES.MESH_RENDERER
    );
    expect(renderer?.fields.Materials).toEqual({
      $type: 'list',
      elements: [{ $type: 'reference', targetId: 'shared-mat-id' }],
    });
  });

  it('does not deduplicate materials when fields differ', () => {
    const objects: ResoniteObject[] = [createObject('a'), createObject('b')];
    const materialB = objects[1].components.find(
      (component) => component.type === COMPONENT_TYPES.XIEXE_TOON_MATERIAL
    );
    if (!materialB) {
      throw new Error('material missing');
    }
    materialB.fields = {
      ...materialB.fields,
      Color: {
        $type: 'colorX',
        value: { r: 1, g: 1, b: 1, a: 0.5, profile: 'sRGB' },
      },
    };

    const definitions = prepareSharedMaterialDefinitions(objects);

    expect(definitions).toHaveLength(2);
  });

  it('does not deduplicate materials when Culling differs', () => {
    const objects: ResoniteObject[] = [createObject('a'), createObject('b')];
    const materialB = objects[1].components.find(
      (component) => component.type === COMPONENT_TYPES.XIEXE_TOON_MATERIAL
    );
    if (!materialB) {
      throw new Error('material missing');
    }
    materialB.fields = {
      ...materialB.fields,
      Culling: { $type: 'enum', value: 'Off', enumType: 'Culling' },
    };

    const definitions = prepareSharedMaterialDefinitions(objects);

    expect(definitions).toHaveLength(2);
  });
});
