import { describe, expect, it } from 'vitest';
import { TableMask } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';
import { applyTableMaskConversion } from './tableMaskConverter';

describe('applyTableMaskConversion', () => {
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
      properties: new Map([['opacity', 40]]),
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-mask-1',
      name: 'Mask',
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 0, z: 0 },
      textures: [],
      components: [],
      children: [],
    };

    applyTableMaskConversion(udonObj, resoniteObj);

    expect(resoniteObj.rotation).toEqual({ x: 90, y: 0, z: 0 });
    expect(resoniteObj.position).toEqual({ x: 3.5, y: 2.002, z: 1.5 });

    const quadMesh = resoniteObj.components.find(
      (component) => component.type === '[FrooxEngine]FrooxEngine.QuadMesh'
    );
    expect(quadMesh?.fields).toEqual({
      Size: { $type: 'float2', value: { x: 5, y: 3 } },
      DualSided: { $type: 'bool', value: true },
    });

    const material = resoniteObj.components.find(
      (component) => component.type === '[FrooxEngine]FrooxEngine.XiexeToonMaterial'
    );
    expect(material?.fields).toMatchObject({
      BlendMode: { $type: 'enum', value: 'Alpha', enumType: 'BlendMode' },
      Color: {
        $type: 'colorX',
        value: { r: 0, g: 0, b: 0, a: 0.4, profile: 'Linear' },
      },
    });

    const collider = resoniteObj.components.find(
      (component) => component.type === '[FrooxEngine]FrooxEngine.BoxCollider'
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
      properties: new Map([['opacity', 70]]),
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-mask-2',
      name: 'Mask With Image',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      textures: ['none_icon'],
      components: [],
      children: [],
    };

    applyTableMaskConversion(udonObj, resoniteObj);

    const material = resoniteObj.components.find(
      (component) => component.type === '[FrooxEngine]FrooxEngine.XiexeToonMaterial'
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
      properties: new Map(),
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-mask-unlocked',
      name: 'Unlocked Mask',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      textures: [],
      components: [],
      children: [],
    };

    applyTableMaskConversion(udonObj, resoniteObj);

    const grabbable = resoniteObj.components.find(
      (component) => component.type === '[FrooxEngine]FrooxEngine.Grabbable'
    );
    expect(grabbable).toBeDefined();
    expect(grabbable?.id).toBe('slot-mask-unlocked-grabbable');
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
      properties: new Map(),
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-mask-locked',
      name: 'Locked Mask',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      textures: [],
      components: [],
      children: [],
    };

    applyTableMaskConversion(udonObj, resoniteObj);

    const grabbable = resoniteObj.components.find(
      (component) => component.type === '[FrooxEngine]FrooxEngine.Grabbable'
    );
    expect(grabbable).toBeUndefined();
  });
});
