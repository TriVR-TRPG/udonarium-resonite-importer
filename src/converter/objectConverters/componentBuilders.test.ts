import { describe, it, expect } from 'vitest';
import { buildQuadMeshComponents, toTextureReference } from './componentBuilders';

describe('componentBuilders', () => {
  it('uses shared StaticTexture2D references without creating local texture components', () => {
    const components = buildQuadMeshComponents('slot-1', toTextureReference('shared-texture-id'));

    expect(components.find((c) => c.type.endsWith('StaticTexture2D'))).toBeUndefined();

    const material = components.find((c) => c.type.endsWith('XiexeToonMaterial'));
    expect(material?.fields).toEqual({
      BlendMode: { $type: 'enum', value: 'Cutout', enumType: 'BlendMode' },
      ShadowRamp: { $type: 'reference', targetId: null },
      ShadowSharpness: { $type: 'float', value: 0 },
    });

    const textureBlock = components.find((c) => c.type.endsWith('MainTexturePropertyBlock'));
    expect(textureBlock).toBeUndefined();

    const renderer = components.find((c) => c.type.endsWith('MeshRenderer'));
    expect(renderer?.fields.MaterialPropertyBlocks).toEqual({
      $type: 'list',
      elements: [
        {
          $type: 'reference',
          targetId: 'shared-texture-id-main-texture-property-block',
        },
      ],
    });

    expect(material).toBeDefined();
  });
});
