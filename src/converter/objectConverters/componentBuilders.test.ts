import { describe, it, expect } from 'vitest';
import { buildQuadMeshComponents, toTextureReference } from './componentBuilders';

describe('componentBuilders', () => {
  it('uses shared StaticTexture2D references without creating local texture components', () => {
    const components = buildQuadMeshComponents('slot-1', toTextureReference('shared-texture-id'));

    expect(components.find((c) => c.type.endsWith('StaticTexture2D'))).toBeUndefined();

    const material = components.find((c) => c.type.endsWith('XiexeToonMaterial'));
    expect(material?.fields).toEqual({
      BlendMode: { $type: 'enum', value: 'Cutout', enumType: 'BlendMode' },
    });

    const textureBlock = components.find((c) => c.type.endsWith('MainTexturePropertyBlock'));
    expect(textureBlock?.fields.Texture).toEqual({
      $type: 'reference',
      targetId: 'shared-texture-id',
    });

    expect(material).toBeDefined();
  });
});
