import { describe, expect, it } from 'vitest';
import { TableMask } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';
import { convertTableMask } from './tableMaskConverter';
import { COMPONENT_TYPES } from '../../config/ResoniteComponentTypes';

describe('convertTableMask', () => {
  it('uses black color and opacity alpha when image is not set', () => {
    const udonObj: TableMask = {
      id: 'mask-1',
      type: 'table-mask',
      name: 'Mask',
      position: { x: 0, y: 0, z: 0 },
      isLock: false,
      width: 5,
      height: 3,
      images: [],
      opacity: 40,
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-mask-1',
      name: 'Mask',
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 0, z: 0 },
      components: [],
      children: [],
      isActive: true,
    };

    const result = convertTableMask(udonObj, resoniteObj.position, undefined, resoniteObj.id);

    expect(result.rotation).toEqual({ x: 90, y: 0, z: 0 });
    expect(result.position).toEqual({ x: 3.5, y: 2.002, z: 1.5 });

    const quadMesh = result.components.find(
      (component) => component.type === COMPONENT_TYPES.QUAD_MESH
    );
    expect(quadMesh?.fields).toEqual({
      Size: { $type: 'float2', value: { x: 5, y: 3 } },
    });

    const material = result.components.find(
      (component) => component.type === COMPONENT_TYPES.XIEXE_TOON_MATERIAL
    );
    expect(material?.fields).toMatchObject({
      BlendMode: { $type: 'enum', value: 'Alpha', enumType: 'BlendMode' },
      Culling: { $type: 'enum', value: 'Off', enumType: 'Culling' },
      Color: {
        $type: 'colorX',
        value: { r: 0, g: 0, b: 0, a: 0.4, profile: 'Linear' },
      },
    });

    const collider = result.components.find(
      (component) => component.type === COMPONENT_TYPES.BOX_COLLIDER
    );
    expect(collider?.fields).toEqual({
      Size: { $type: 'float3', value: { x: 5, y: 3, z: 0.01 } },
    });
  });

  it('uses white color and opacity alpha when image is set', () => {
    const udonObj: TableMask = {
      id: 'mask-2',
      type: 'table-mask',
      name: 'Mask With Image',
      position: { x: 0, y: 0, z: 0 },
      isLock: false,
      width: 4,
      height: 2,
      images: [{ identifier: 'none_icon', name: 'mask' }],
      opacity: 70,
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-mask-2',
      name: 'Mask With Image',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      components: [],
      children: [],
      isActive: true,
    };

    const result = convertTableMask(udonObj, resoniteObj.position, undefined, resoniteObj.id);

    const material = result.components.find(
      (component) => component.type === COMPONENT_TYPES.XIEXE_TOON_MATERIAL
    );
    expect(material?.fields).toMatchObject({
      Color: {
        $type: 'colorX',
        value: { r: 1, g: 1, b: 1, a: 0.7, profile: 'Linear' },
      },
    });
  });

  it('adds Grabbable component when isLock is false', () => {
    const udonObj: TableMask = {
      id: 'mask-unlocked',
      type: 'table-mask',
      name: 'Unlocked Mask',
      position: { x: 0, y: 0, z: 0 },
      isLock: false,
      width: 4,
      height: 4,
      images: [],
      opacity: 100,
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-mask-unlocked',
      name: 'Unlocked Mask',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      components: [],
      children: [],
      isActive: true,
    };

    const result = convertTableMask(udonObj, resoniteObj.position, undefined, resoniteObj.id);

    const grabbable = result.components.find(
      (component) => component.type === COMPONENT_TYPES.GRABBABLE
    );
    expect(grabbable).toBeDefined();
    expect(grabbable?.id).toBe('slot-mask-unlocked-grabbable');
    expect(grabbable?.fields).toEqual({
      Scalable: { $type: 'bool', value: true },
    });
  });

  it('does not add Grabbable component when isLock is true', () => {
    const udonObj: TableMask = {
      id: 'mask-locked',
      type: 'table-mask',
      name: 'Locked Mask',
      position: { x: 0, y: 0, z: 0 },
      isLock: true,
      width: 4,
      height: 4,
      images: [],
      opacity: 100,
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-mask-locked',
      name: 'Locked Mask',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      components: [],
      children: [],
      isActive: true,
    };

    const result = convertTableMask(udonObj, resoniteObj.position, undefined, resoniteObj.id);

    const grabbable = result.components.find(
      (component) => component.type === COMPONENT_TYPES.GRABBABLE
    );
    expect(grabbable).toBeUndefined();
  });
});
