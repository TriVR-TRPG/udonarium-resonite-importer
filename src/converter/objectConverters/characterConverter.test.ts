import { describe, expect, it, vi } from 'vitest';
import { convertCharacter } from './characterConverter';
import { GameCharacter } from '../../domain/UdonariumObject';
import { ResoniteObject, Vector3 } from '../../domain/ResoniteObject';
import { COMPONENT_TYPES } from '../../config/ResoniteComponentTypes';

describe('convertCharacter', () => {
  it('converts character and generates quad mesh, material, and collider', () => {
    const udonObj: GameCharacter = {
      id: 'char-1',
      type: 'character',
      name: 'Character',
      position: { x: 0, y: 0, z: 0 },
      images: [{ identifier: 'char.png', name: 'char.png' }],
      locationName: 'graveyard',
      size: 3,
      rotate: 30,
      roll: 15,
      resources: [],
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-char-1',
      name: 'Character',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      components: [],
      children: [],
      isActive: true,
    };
    const converted: Vector3 = { x: 0.3, y: 0.3, z: 0.3 };
    const convertSize = vi.fn().mockReturnValue(converted);

    const result = convertCharacter(
      udonObj,
      resoniteObj.position,
      convertSize,
      undefined,
      undefined,
      undefined,
      resoniteObj.id
    );

    expect(convertSize).toHaveBeenCalledWith(3);
    expect(result.components.map((c) => c.type)).toEqual([
      COMPONENT_TYPES.QUAD_MESH,
      COMPONENT_TYPES.STATIC_TEXTURE_2D,
      COMPONENT_TYPES.XIEXE_TOON_MATERIAL,
      COMPONENT_TYPES.MAIN_TEXTURE_PROPERTY_BLOCK,
      COMPONENT_TYPES.MESH_RENDERER,
      COMPONENT_TYPES.BOX_COLLIDER,
      COMPONENT_TYPES.GRABBABLE,
    ]);
    expect(result.components[0].fields).toEqual({
      Size: { $type: 'float2', value: { x: 0.3, y: 0.3 } },
    });
    expect(result.position.x).toBe(0.15);
    expect(result.position.z).toBe(-0.15);
    expect(result.position.y).toBe(0.15);
    expect(result.rotation).toEqual({ x: 0, y: 30, z: 15 });
    expect(result.sourceType).toBe('character');
    expect((result as { locationName?: string }).locationName).toBe('graveyard');

    const materialComponent = result.components.find(
      (c) => c.type === COMPONENT_TYPES.XIEXE_TOON_MATERIAL
    );
    expect(materialComponent?.fields).toEqual({
      BlendMode: { $type: 'enum', value: 'Opaque', enumType: 'BlendMode' },
      ShadowRamp: { $type: 'reference', targetId: null },
      ShadowSharpness: { $type: 'float', value: 0 },
      Culling: { $type: 'enum', value: 'Off', enumType: 'Culling' },
    });
    const textureBlockComponent = result.components.find(
      (c) => c.type === COMPONENT_TYPES.MAIN_TEXTURE_PROPERTY_BLOCK
    );
    expect(textureBlockComponent?.fields).toEqual({
      Texture: { $type: 'reference', targetId: 'slot-char-1-tex' },
    });
    expect(result.components[5].fields).toEqual({
      Size: { $type: 'float3', value: { x: 0.3, y: 0.3, z: 0.05 } },
    });
    expect(result.components[6].fields).toEqual({
      Scalable: { $type: 'bool', value: true },
    });
  });

  it('does not generate mesh components when character has no image', () => {
    const udonObj: GameCharacter = {
      id: 'char-no-image',
      type: 'character',
      name: 'No Image Character',
      locationName: 'table',
      position: { x: 0, y: 0, z: 0 },
      images: [],
      size: 2,
      rotate: 0,
      roll: 0,
      resources: [],
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-char-no-image',
      name: 'No Image Character',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      components: [],
      children: [],
      isActive: true,
    };
    const convertSize = vi.fn().mockReturnValue({ x: 1, y: 1, z: 1 });

    const result = convertCharacter(
      udonObj,
      resoniteObj.position,
      convertSize,
      undefined,
      undefined,
      undefined,
      resoniteObj.id
    );

    expect(result.components.map((c) => c.type)).toEqual([
      COMPONENT_TYPES.BOX_COLLIDER,
      COMPONENT_TYPES.GRABBABLE,
    ]);
  });

  it('generates image mesh using image aspect ratio while keeping width at size', () => {
    const udonObj: GameCharacter = {
      id: 'char-ratio',
      type: 'character',
      name: 'Ratio Character',
      locationName: 'table',
      position: { x: 0, y: 0, z: 0 },
      images: [{ identifier: 'char-ratio.png', name: 'char-ratio.png' }],
      size: 1,
      rotate: 0,
      roll: 0,
      resources: [],
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-char-ratio',
      name: 'Ratio Character',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      components: [],
      children: [],
      isActive: true,
    };
    const convertSize = vi.fn().mockReturnValue({ x: 1, y: 1, z: 1 });
    const imageAspectRatioMap = new Map<string, number>([['char-ratio.png', 2]]);

    const result = convertCharacter(
      udonObj,
      resoniteObj.position,
      convertSize,
      undefined,
      imageAspectRatioMap,
      undefined,
      resoniteObj.id
    );

    const quad = result.components.find((c) => c.type === COMPONENT_TYPES.QUAD_MESH);
    expect(quad?.fields.Size).toEqual({ $type: 'float2', value: { x: 1, y: 2 } });
    const collider = result.components.find((c) => c.type === COMPONENT_TYPES.BOX_COLLIDER);
    expect(collider?.fields.Size).toEqual({ $type: 'float3', value: { x: 1, y: 2, z: 0.05 } });
    expect(result.position).toEqual({ x: 0.5, y: 1, z: -0.5 });
  });
});
