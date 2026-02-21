import { describe, expect, it } from 'vitest';
import { ResoniteObjectBuilder } from './ResoniteObjectBuilder';
import { COMPONENT_TYPES } from '../config/ResoniteComponentTypes';
import { buildImageAssetContext } from './imageAssetContext';

function makeSpec(id = 'slot-abc') {
  return {
    id,
    name: 'Test',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  };
}

function makeBuilder(spec = makeSpec()) {
  return ResoniteObjectBuilder.create({ id: spec.id, name: spec.name })
    .setPosition(spec.position)
    .setRotation(spec.rotation);
}

describe('ResoniteObjectBuilder', () => {
  describe('build()', () => {
    it('returns a ResoniteObject with the given spec', () => {
      const result = makeBuilder(makeSpec('my-slot')).build();

      expect(result.id).toBe('my-slot');
      expect(result.name).toBe('Test');
      expect(result.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(result.rotation).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('starts with empty components and children', () => {
      const result = makeBuilder(makeSpec()).build();

      expect(result.components).toEqual([]);
      expect(result.children).toEqual([]);
    });

    it('returns a shallow copy so further mutations do not affect prior build results', () => {
      const builder = makeBuilder(makeSpec());
      const first = builder.build();
      builder.addGrabbable();
      const second = builder.build();

      expect(first.components).toHaveLength(0);
      expect(second.components).toHaveLength(1);
    });

    it('generates an id when omitted in create()', () => {
      const result = ResoniteObjectBuilder.create({ name: 'Generated' }).build();

      expect(result.id).toMatch(/^udon-imp-/);
      expect(result.name).toBe('Generated');
    });

    it('exposes generated id via getId()', () => {
      const builder = ResoniteObjectBuilder.create({ name: 'Generated' });

      expect(builder.getId()).toMatch(/^udon-imp-/);
    });
  });

  describe('addQuadMesh()', () => {
    it('derives all component IDs from the slot ID', () => {
      const result = makeBuilder(makeSpec('s1'))
        .addQuadMesh({ textureIdentifier: 'img.png' })
        .build();

      for (const c of result.components) {
        expect(c.id).toMatch(/^s1-/);
      }
    });

    it('adds QuadMesh, StaticTexture2D, XiexeToonMaterial, MainTexturePropertyBlock, MeshRenderer when texture is given', () => {
      const result = makeBuilder(makeSpec()).addQuadMesh({ textureIdentifier: 'img.png' }).build();

      expect(result.components.map((c) => c.type)).toEqual([
        COMPONENT_TYPES.QUAD_MESH,
        COMPONENT_TYPES.STATIC_TEXTURE_2D,
        COMPONENT_TYPES.XIEXE_TOON_MATERIAL,
        COMPONENT_TYPES.MAIN_TEXTURE_PROPERTY_BLOCK,
        COMPONENT_TYPES.MESH_RENDERER,
      ]);
    });

    it('sets material Culling=Off when dualSided=true', () => {
      const result = makeBuilder(makeSpec()).addQuadMesh({ dualSided: true }).build();

      const quad = result.components.find((c) => c.type.endsWith('QuadMesh'));
      expect(quad?.fields.DualSided).toBeUndefined();
      const mat = result.components.find((c) => c.type.endsWith('XiexeToonMaterial'));
      expect(mat?.fields.Culling).toEqual({
        $type: 'enum',
        value: 'Off',
        enumType: 'Culling',
      });
    });

    it('applies the given size to the QuadMesh', () => {
      const result = makeBuilder(makeSpec())
        .addQuadMesh({ size: { x: 2, y: 3 } })
        .build();

      const quad = result.components.find((c) => c.type.endsWith('QuadMesh'));
      expect(quad?.fields.Size).toEqual({ $type: 'float2', value: { x: 2, y: 3 } });
    });

    it('rounds QuadMesh size values to 4 decimal places', () => {
      const result = makeBuilder(makeSpec())
        .addQuadMesh({ size: { x: 1.123456, y: 2.987654 } })
        .build();

      const quad = result.components.find((c) => c.type.endsWith('QuadMesh'));
      expect(quad?.fields.Size).toEqual({ $type: 'float2', value: { x: 1.1235, y: 2.9877 } });
    });

    it('resolves textureValue from imageAssetInfoMap while using textureIdentifier for blend lookup', () => {
      const imageAssetContext = buildImageAssetContext({
        imageAssetInfoMap: new Map([
          [
            'front.png',
            {
              identifier: 'front.png',
              textureValue: 'texture-ref://shared-front-static-texture',
            },
          ],
        ]),
        imageBlendModeMap: new Map([['front.png', 'Opaque' as const]]),
      });
      const result = makeBuilder(makeSpec('s-map'))
        .addQuadMesh({
          textureIdentifier: 'front.png',
          dualSided: false,
          size: { x: 1, y: 1 },
          imageAssetContext,
        })
        .build();

      expect(result.components.find((c) => c.type.endsWith('StaticTexture2D'))).toBeUndefined();
      const material = result.components.find((c) => c.type.endsWith('XiexeToonMaterial'));
      expect(material?.fields.BlendMode).toEqual({
        $type: 'enum',
        value: 'Opaque',
        enumType: 'BlendMode',
      });
    });

    it('applies blendMode from imageAssetContext to the material', () => {
      const imageAssetContext = buildImageAssetContext({
        imageBlendModeMap: new Map([['front.png', 'Alpha' as const]]),
      });
      const result = makeBuilder(makeSpec())
        .addQuadMesh({ size: { x: 1, y: 1 }, textureIdentifier: 'front.png', imageAssetContext })
        .build();

      const mat = result.components.find((c) => c.type.endsWith('XiexeToonMaterial'));
      expect(mat?.fields.BlendMode).toEqual({
        $type: 'enum',
        value: 'Alpha',
        enumType: 'BlendMode',
      });
    });

    it('returns this for chaining', () => {
      const builder = makeBuilder(makeSpec());
      expect(builder.addQuadMesh({})).toBe(builder);
    });
  });

  describe('addTriangleMesh()', () => {
    it('adds TriangleMesh and MeshRenderer components', () => {
      const result = makeBuilder(makeSpec())
        .addTriangleMesh({
          vertices: [
            { x: -1, y: -1, z: 0 },
            { x: 1, y: -1, z: 0 },
            { x: 1, y: 1, z: 0 },
          ],
        })
        .build();

      expect(result.components.map((c) => c.type)).toEqual([
        COMPONENT_TYPES.TRIANGLE_MESH,
        COMPONENT_TYPES.XIEXE_TOON_MATERIAL,
        COMPONENT_TYPES.MESH_RENDERER,
      ]);
    });

    it('sets vertex positions on TriangleMesh fields', () => {
      const result = makeBuilder(makeSpec('tri-slot'))
        .addTriangleMesh({
          vertices: [
            { x: -2, y: -1, z: 0 },
            { x: 2, y: -1, z: 0 },
            { x: 2, y: 3, z: 0 },
          ],
        })
        .build();

      const mesh = result.components.find((c) => c.type === COMPONENT_TYPES.TRIANGLE_MESH);
      expect(mesh?.fields.Vertex0).toEqual({
        $type: 'syncObject',
        members: {
          Position: { $type: 'float3', value: { x: -2, y: -1, z: 0 } },
          UV0: { $type: 'float2', value: { x: 0, y: 1 } },
        },
      });
      expect(mesh?.fields.Vertex2).toEqual({
        $type: 'syncObject',
        members: {
          Position: { $type: 'float3', value: { x: 2, y: 3, z: 0 } },
          UV0: { $type: 'float2', value: { x: 0.5, y: 0 } },
        },
      });
    });
  });

  describe('addBoxCollider()', () => {
    it('derives the component ID from the slot ID', () => {
      const result = makeBuilder(makeSpec('s2')).addBoxCollider({ x: 1, y: 1, z: 1 }).build();

      const collider = result.components.find((c) => c.type.endsWith('BoxCollider'));
      expect(collider?.id).toBe('s2-collider');
    });

    it('sets the Size field', () => {
      const result = makeBuilder(makeSpec()).addBoxCollider({ x: 2, y: 3, z: 4 }).build();

      const collider = result.components.find((c) => c.type.endsWith('BoxCollider'));
      expect(collider?.fields.Size).toEqual({ $type: 'float3', value: { x: 2, y: 3, z: 4 } });
    });

    it('adds CharacterCollider field when option is set', () => {
      const result = makeBuilder(makeSpec())
        .addBoxCollider({ x: 1, y: 1, z: 1 }, { characterCollider: true })
        .build();

      const collider = result.components.find((c) => c.type.endsWith('BoxCollider'));
      expect(collider?.fields.CharacterCollider).toEqual({ $type: 'bool', value: true });
    });

    it('does not add CharacterCollider when option is not set', () => {
      const result = makeBuilder(makeSpec()).addBoxCollider({ x: 1, y: 1, z: 1 }).build();

      const collider = result.components.find((c) => c.type.endsWith('BoxCollider'));
      expect(collider?.fields.CharacterCollider).toBeUndefined();
    });

    it('returns this for chaining', () => {
      const builder = makeBuilder(makeSpec());
      expect(builder.addBoxCollider({ x: 1, y: 1, z: 1 })).toBe(builder);
    });
  });

  describe('addGrabbable()', () => {
    it('derives the component ID from the slot ID', () => {
      const result = makeBuilder(makeSpec('s3')).addGrabbable().build();

      const grabbable = result.components.find((c) => c.type.endsWith('Grabbable'));
      expect(grabbable?.id).toBe('s3-grabbable');
    });

    it('sets Scalable: true', () => {
      const result = makeBuilder(makeSpec()).addGrabbable().build();

      const grabbable = result.components.find((c) => c.type.endsWith('Grabbable'));
      expect(grabbable?.fields).toEqual({ Scalable: { $type: 'bool', value: true } });
    });

    it('returns this for chaining', () => {
      const builder = makeBuilder(makeSpec());
      expect(builder.addGrabbable()).toBe(builder);
    });
  });

  describe('addTextComponent()', () => {
    it('derives the component ID from the slot ID', () => {
      const result = makeBuilder(makeSpec('s4')).addTextComponent('Hello', 16).build();

      const text = result.components.find((c) => c.type.endsWith('UIX.Text'));
      expect(text?.id).toBe('s4-text');
    });

    it('sets Content and Size fields', () => {
      const result = makeBuilder(makeSpec()).addTextComponent('Hello', 16).build();

      const text = result.components.find((c) => c.type.endsWith('UIX.Text'));
      expect(text?.fields).toEqual({
        Content: { $type: 'string', value: 'Hello' },
        Size: { $type: 'float', value: 16 },
      });
    });
  });

  describe('addQuadMesh() color option', () => {
    it('adds a Color field to the XiexeToonMaterial when color is given', () => {
      const result = makeBuilder(makeSpec())
        .addQuadMesh({
          size: { x: 1, y: 1 },
          color: {
            r: 0.5,
            g: 0.5,
            b: 0.5,
            a: 0.8,
            profile: 'Linear',
          },
        })
        .build();

      const mat = result.components.find((c) => c.type.endsWith('XiexeToonMaterial'));
      expect(mat?.fields.Color).toEqual({
        $type: 'colorX',
        value: { r: 0.5, g: 0.5, b: 0.5, a: 0.8, profile: 'Linear' },
      });
    });

    it('preserves existing material fields (e.g. BlendMode) alongside color', () => {
      const imageAssetContext = buildImageAssetContext({
        imageBlendModeMap: new Map([['front.png', 'Alpha' as const]]),
      });
      const result = makeBuilder(makeSpec())
        .addQuadMesh({
          size: { x: 1, y: 1 },
          textureIdentifier: 'front.png',
          imageAssetContext,
          color: {
            r: 0,
            g: 0,
            b: 0,
            a: 1,
            profile: 'Linear',
          },
        })
        .build();

      const mat = result.components.find((c) => c.type.endsWith('XiexeToonMaterial'));
      expect(mat?.fields.BlendMode).toEqual({
        $type: 'enum',
        value: 'Alpha',
        enumType: 'BlendMode',
      });
    });

    it('does not add Color field when color is not given', () => {
      const imageAssetContext = buildImageAssetContext({
        imageBlendModeMap: new Map([['front.png', 'Alpha' as const]]),
      });
      const result = makeBuilder(makeSpec())
        .addQuadMesh({
          size: { x: 1, y: 1 },
          textureIdentifier: 'front.png',
          imageAssetContext,
        })
        .build();

      const mat = result.components.find((c) => c.type.endsWith('XiexeToonMaterial'));
      expect(mat?.fields.Color).toBeUndefined();
    });
  });

  describe('addChild() / addChildren()', () => {
    const childA = {
      id: 'child-a',
      name: 'A',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      components: [],
      children: [],
      isActive: true,
    };
    const childB = { ...childA, id: 'child-b', name: 'B' };

    it('addChild appends one child', () => {
      const result = makeBuilder(makeSpec()).addChild(childA).build();

      expect(result.children).toHaveLength(1);
      expect(result.children[0].id).toBe('child-a');
    });

    it('addChildren appends multiple children in order', () => {
      const result = makeBuilder(makeSpec()).addChildren([childA, childB]).build();

      expect(result.children.map((c) => c.id)).toEqual(['child-a', 'child-b']);
    });

    it('addChild returns this for chaining', () => {
      const builder = makeBuilder(makeSpec());
      expect(builder.addChild(childA)).toBe(builder);
    });

    it('addChildren returns this for chaining', () => {
      const builder = makeBuilder(makeSpec());
      expect(builder.addChildren([childA])).toBe(builder);
    });
  });

  describe('method chaining', () => {
    it('produces the correct component order when chaining multiple add methods', () => {
      const result = makeBuilder(makeSpec('s5'))
        .addQuadMesh({
          textureIdentifier: 'img.png',
          dualSided: true,
          size: { x: 2, y: 3 },
        })
        .addBoxCollider({ x: 2, y: 3, z: 0.05 })
        .addGrabbable()
        .build();

      expect(result.components.map((c) => c.type)).toEqual([
        COMPONENT_TYPES.QUAD_MESH,
        COMPONENT_TYPES.STATIC_TEXTURE_2D,
        COMPONENT_TYPES.XIEXE_TOON_MATERIAL,
        COMPONENT_TYPES.MAIN_TEXTURE_PROPERTY_BLOCK,
        COMPONENT_TYPES.MESH_RENDERER,
        COMPONENT_TYPES.BOX_COLLIDER,
        COMPONENT_TYPES.GRABBABLE,
      ]);
    });

    it('all component IDs are derived from the same slot ID', () => {
      const result = makeBuilder(makeSpec('my-id'))
        .addQuadMesh({ textureIdentifier: 'img.png' })
        .addBoxCollider({ x: 1, y: 1, z: 1 })
        .addGrabbable()
        .build();

      for (const c of result.components) {
        expect(c.id).toMatch(/^my-id-/);
      }
    });
  });

  describe('addQuadMesh() with shared texture reference', () => {
    it('uses textureIdentifier for blend lookup when textureValue is a shared reference', () => {
      const imageAssetContext = buildImageAssetContext({
        imageAssetInfoMap: new Map([
          [
            'front.png',
            {
              identifier: 'front.png',
              textureValue: 'texture-ref://shared-texture-id',
            },
          ],
        ]),
        imageBlendModeMap: new Map([['front.png', 'Opaque' as const]]),
      });
      const result = makeBuilder(makeSpec('slot-lookup'))
        .addQuadMesh({
          textureIdentifier: 'front.png',
          dualSided: false,
          size: { x: 1, y: 1 },
          imageAssetContext,
        })
        .build();

      const material = result.components.find((c) => c.type.endsWith('XiexeToonMaterial'));
      expect(material?.fields.BlendMode).toEqual({
        $type: 'enum',
        value: 'Opaque',
        enumType: 'BlendMode',
      });
    });

    it('uses shared StaticTexture2D references without creating local texture components', () => {
      const result = makeBuilder(makeSpec('slot-1'))
        .addQuadMesh({ textureIdentifier: 'texture-ref://shared-texture-id' })
        .build();

      expect(result.components.find((c) => c.type.endsWith('StaticTexture2D'))).toBeUndefined();

      const material = result.components.find((c) => c.type.endsWith('XiexeToonMaterial'));
      expect(material?.fields).toEqual({
        BlendMode: { $type: 'enum', value: 'Cutout', enumType: 'BlendMode' },
        ShadowRamp: { $type: 'reference', targetId: null },
        ShadowSharpness: { $type: 'float', value: 0 },
      });

      expect(
        result.components.find((c) => c.type.endsWith('MainTexturePropertyBlock'))
      ).toBeUndefined();

      const renderer = result.components.find((c) => c.type.endsWith('MeshRenderer'));
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

  describe('optional ResoniteObject fields', () => {
    it('preserves sourceType and isActive from spec', () => {
      const result = makeBuilder(makeSpec()).setSourceType('character').setActive(false).build();

      expect(result.sourceType).toBe('character');
      expect(result.isActive).toBe(false);
    });
  });
});
