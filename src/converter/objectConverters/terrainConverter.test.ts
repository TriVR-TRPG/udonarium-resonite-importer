import { describe, expect, it } from 'vitest';
import { convertTerrain } from './terrainConverter';
import { Terrain } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';
import { COMPONENT_TYPES } from '../../config/ResoniteComponentTypes';
import { buildImageAssetContext } from '../imageAssetContext';

describe('convertTerrain', () => {
  it('terrain (unlocked) has BoxCollider + Grabbable and creates top plus four wall faces', () => {
    const udonObj: Terrain = {
      id: 'terrain-1',
      type: 'terrain',
      isLocked: false,
      mode: 3,
      rotate: 0,
      name: 'Terrain',
      position: { x: 0, y: 0, z: 0 },
      images: [{ identifier: 'wall.png', name: 'wall.png' }],
      width: 10,
      height: 2,
      depth: 4,
      wallImage: { identifier: 'wall.png', name: 'wall.png' },
      floorImage: { identifier: 'floor.png', name: 'floor.png' },
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-terrain-1',
      name: 'Terrain',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      components: [],
      children: [],
      isActive: true,
    };

    const result = convertTerrain(
      udonObj,
      resoniteObj.position,
      buildImageAssetContext(),
      undefined,
      resoniteObj.id
    );

    expect(result.components.map((c) => c.type)).toEqual([
      COMPONENT_TYPES.BOX_COLLIDER,
      COMPONENT_TYPES.GRABBABLE,
    ]);
    expect(result.components[0].fields).toEqual({
      Size: {
        $type: 'float3',
        value: {
          x: 10,
          y: 2,
          z: 4,
        },
      },
    });
    expect(result.position.x).toBe(5);
    expect(result.position.y).toBe(1);
    expect(result.position.z).toBe(-2);

    expect(result.children).toHaveLength(5);
    const topFace = result.children.find((child) => child.id === 'slot-terrain-1-top');
    const bottomFace = result.children.find((child) => child.id === 'slot-terrain-1-bottom');
    expect(topFace).toBeDefined();
    expect(bottomFace).toBeUndefined();
    expect(topFace?.components.map((c) => c.type)).toEqual([
      COMPONENT_TYPES.QUAD_MESH,
      COMPONENT_TYPES.STATIC_TEXTURE_2D,
      COMPONENT_TYPES.XIEXE_TOON_MATERIAL,
      COMPONENT_TYPES.MAIN_TEXTURE_PROPERTY_BLOCK,
      COMPONENT_TYPES.MESH_RENDERER,
    ]);

    const wallFaces = [
      result.children.find((child) => child.id === 'slot-terrain-1-front'),
      result.children.find((child) => child.id === 'slot-terrain-1-back'),
      result.children.find((child) => child.id === 'slot-terrain-1-left'),
      result.children.find((child) => child.id === 'slot-terrain-1-right'),
    ];
    const definedWallFaces = wallFaces.filter((face): face is NonNullable<typeof face> => !!face);
    expect(definedWallFaces).toHaveLength(4);
    for (const wallFace of definedWallFaces) {
      expect(wallFace.components.map((c) => c.type)).toEqual([
        COMPONENT_TYPES.QUAD_MESH,
        COMPONENT_TYPES.STATIC_TEXTURE_2D,
        COMPONENT_TYPES.XIEXE_TOON_MATERIAL,
        COMPONENT_TYPES.MAIN_TEXTURE_PROPERTY_BLOCK,
        COMPONENT_TYPES.MESH_RENDERER,
      ]);
    }

    expect(topFace?.position).toEqual({ x: 0, y: 1, z: 0 });
    expect(topFace?.rotation).toEqual({ x: 90, y: 0, z: 0 });
    expect(topFace?.components[0].fields).toEqual({
      Size: { $type: 'float2', value: { x: 10, y: 4 } },
    });
    const topMaterial = topFace?.components.find(
      (component) => component.type === COMPONENT_TYPES.XIEXE_TOON_MATERIAL
    );
    expect(topMaterial?.fields.Culling).toEqual({
      $type: 'enum',
      value: 'Off',
      enumType: 'Culling',
    });

    const frontFace = result.children.find((child) => child.id === 'slot-terrain-1-front');
    expect(frontFace?.position).toEqual({ x: 0, y: 0, z: -2 });
    expect(frontFace?.components[0].fields).toEqual({
      Size: { $type: 'float2', value: { x: 10, y: 2 } },
    });

    const backFace = result.children.find((child) => child.id === 'slot-terrain-1-back');
    expect(backFace?.scale).toEqual({ x: -1, y: 1, z: 1 });
    const leftFace = result.children.find((child) => child.id === 'slot-terrain-1-left');
    expect(leftFace?.scale).toEqual({ x: -1, y: 1, z: 1 });
    expect(leftFace?.position).toEqual({ x: -5, y: 0, z: 0 });
    expect(leftFace?.components[0].fields).toEqual({
      Size: { $type: 'float2', value: { x: 4, y: 2 } },
    });
  });

  it('terrain (locked) does not add Grabbable and enables CharacterCollider', () => {
    const udonObj: Terrain = {
      id: 'terrain-2',
      type: 'terrain',
      isLocked: true,
      mode: 3,
      rotate: 0,
      name: 'Locked Terrain',
      position: { x: 0, y: 0, z: 0 },
      images: [],
      width: 2,
      height: 2,
      depth: 2,
      wallImage: null,
      floorImage: null,
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-terrain-2',
      name: 'Locked Terrain',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      components: [],
      children: [],
      isActive: true,
    };

    const result = convertTerrain(
      udonObj,
      resoniteObj.position,
      buildImageAssetContext(),
      undefined,
      resoniteObj.id
    );

    expect(result.components.map((c) => c.type)).toEqual([COMPONENT_TYPES.BOX_COLLIDER]);
    expect(result.components[0].fields).toEqual({
      Size: {
        $type: 'float3',
        value: {
          x: 2,
          y: 2,
          z: 2,
        },
      },
      CharacterCollider: {
        $type: 'bool',
        value: true,
      },
    });
  });

  it('terrain (locked) does not add CharacterCollider when option is disabled', () => {
    const udonObj: Terrain = {
      id: 'terrain-2-no-character-collider',
      type: 'terrain',
      isLocked: true,
      mode: 3,
      rotate: 0,
      name: 'Locked Terrain',
      position: { x: 0, y: 0, z: 0 },
      images: [],
      width: 2,
      height: 2,
      depth: 2,
      wallImage: null,
      floorImage: null,
    };

    const result = convertTerrain(
      udonObj,
      { x: 0, y: 0, z: 0 },
      buildImageAssetContext(),
      { enableCharacterColliderOnLockedTerrain: false },
      'slot-terrain-2-no-character-collider'
    );

    expect(result.components.map((c) => c.type)).toEqual([COMPONENT_TYPES.BOX_COLLIDER]);
    expect(result.components[0].fields).toEqual({
      Size: {
        $type: 'float3',
        value: {
          x: 2,
          y: 2,
          z: 2,
        },
      },
    });
  });

  it('terrain mode=1 does not create walls and aligns origin/collider to top surface', () => {
    const udonObj: Terrain = {
      id: 'terrain-3',
      type: 'terrain',
      isLocked: false,
      mode: 1,
      rotate: 0,
      name: 'No Walls Terrain',
      position: { x: 0, y: 0, z: 0 },
      images: [{ identifier: 'wall.png', name: 'wall.png' }],
      width: 6,
      height: 2,
      depth: 4,
      wallImage: { identifier: 'wall.png', name: 'wall.png' },
      floorImage: { identifier: 'floor.png', name: 'floor.png' },
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-terrain-3',
      name: 'No Walls Terrain',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      components: [],
      children: [],
      isActive: true,
    };

    const result = convertTerrain(
      udonObj,
      resoniteObj.position,
      buildImageAssetContext(),
      undefined,
      resoniteObj.id
    );

    expect(result.position).toEqual({ x: 3, y: 2, z: -2 });
    expect(result.components[0].fields).toEqual({
      Size: { $type: 'float3', value: { x: 6, y: 0, z: 4 } },
    });
    expect(result.children).toHaveLength(1);
    expect(result.children[0].id).toBe('slot-terrain-3-top');
    expect(result.children[0].position).toEqual({ x: 0, y: 0, z: 0 });
    expect(result.children[0].components.map((c) => c.type)).toEqual([
      COMPONENT_TYPES.QUAD_MESH,
      COMPONENT_TYPES.STATIC_TEXTURE_2D,
      COMPONENT_TYPES.XIEXE_TOON_MATERIAL,
      COMPONENT_TYPES.MAIN_TEXTURE_PROPERTY_BLOCK,
      COMPONENT_TYPES.MESH_RENDERER,
    ]);
  });

  it('terrain rotate maps to Resonite Y rotation and keeps edge-to-center offset', () => {
    const udonObj: Terrain = {
      id: 'terrain-rotate',
      type: 'terrain',
      isLocked: false,
      mode: 3,
      rotate: 30,
      name: 'Terrain Rotate',
      position: { x: 0, y: 0, z: 0 },
      images: [],
      width: 2,
      height: 2,
      depth: 2,
      wallImage: null,
      floorImage: null,
    };
    const resoniteObj: ResoniteObject = {
      id: 'slot-terrain-rotate',
      name: 'Terrain Rotate',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      components: [],
      children: [],
      isActive: true,
    };

    const result = convertTerrain(
      udonObj,
      resoniteObj.position,
      buildImageAssetContext(),
      undefined,
      resoniteObj.id
    );

    expect(result.position).toEqual({ x: 1, y: 1, z: -1 });
    expect(result.rotation).toEqual({ x: 0, y: 30, z: 0 });
  });

  it('does not create top/bottom mesh slots when width or depth is zero', () => {
    const udonObj: Terrain = {
      id: 'terrain-zero-top-bottom',
      type: 'terrain',
      isLocked: false,
      mode: 3,
      rotate: 0,
      name: 'Zero Top Bottom',
      position: { x: 0, y: 0, z: 0 },
      images: [],
      width: 0,
      height: 2,
      depth: 2,
      wallImage: null,
      floorImage: null,
    };

    const result = convertTerrain(
      udonObj,
      { x: 0, y: 0, z: 0 },
      buildImageAssetContext(),
      undefined,
      'slot-zero-top-bottom'
    );

    expect(result.children.some((child) => child.id.endsWith('-top'))).toBe(false);
    expect(result.children.some((child) => child.id.endsWith('-bottom'))).toBe(false);
    expect(result.children.some((child) => child.id.endsWith('-front'))).toBe(false);
    expect(result.children.some((child) => child.id.endsWith('-back'))).toBe(false);
    expect(result.children.some((child) => child.id.endsWith('-left'))).toBe(true);
    expect(result.children.some((child) => child.id.endsWith('-right'))).toBe(true);
  });

  it('does not create wall mesh slots that require zero height', () => {
    const udonObj: Terrain = {
      id: 'terrain-zero-height',
      type: 'terrain',
      isLocked: false,
      mode: 3,
      rotate: 0,
      name: 'Zero Height',
      position: { x: 0, y: 0, z: 0 },
      images: [],
      width: 4,
      height: 0,
      depth: 4,
      wallImage: null,
      floorImage: null,
    };

    const result = convertTerrain(
      udonObj,
      { x: 0, y: 0, z: 0 },
      buildImageAssetContext(),
      undefined,
      'slot-zero-height'
    );

    expect(result.children.some((child) => child.id.endsWith('-top'))).toBe(true);
    expect(result.children.some((child) => child.id.endsWith('-bottom'))).toBe(false);
    expect(result.children.some((child) => child.id.endsWith('-front'))).toBe(false);
    expect(result.children.some((child) => child.id.endsWith('-back'))).toBe(false);
    expect(result.children.some((child) => child.id.endsWith('-left'))).toBe(false);
    expect(result.children.some((child) => child.id.endsWith('-right'))).toBe(false);
  });

  it('applies lily altitude extension to root Y position', () => {
    const udonObj: Terrain = {
      id: 'terrain-altitude',
      type: 'terrain',
      isLocked: false,
      mode: 3,
      rotate: 0,
      name: 'Altitude Terrain',
      position: { x: 0, y: 0, z: 0 },
      images: [],
      width: 2,
      height: 2,
      depth: 2,
      wallImage: null,
      floorImage: null,
    };

    const result = convertTerrain(
      udonObj,
      { x: 0, y: 0, z: 0 },
      buildImageAssetContext(),
      undefined,
      'slot-terrain-altitude',
      { altitude: -0.5, isSlope: false, slopeDirection: 0 }
    );

    expect(result.position).toEqual({ x: 1, y: 0.5, z: -1 });
  });

  it('applies slope rotation and removes back wall for TOP direction', () => {
    const udonObj: Terrain = {
      id: 'terrain-slope-top',
      type: 'terrain',
      isLocked: true,
      mode: 3,
      rotate: 0,
      name: 'Slope Top',
      position: { x: 0, y: 0, z: 0 },
      images: [],
      width: 2,
      height: 2,
      depth: 2,
      wallImage: null,
      floorImage: null,
    };

    const result = convertTerrain(
      udonObj,
      { x: 0, y: 0, z: 0 },
      buildImageAssetContext(),
      undefined,
      'slot-terrain-slope-top',
      { altitude: 0, isSlope: true, slopeDirection: 1 }
    );

    const topFace = result.children.find((child) => child.id.endsWith('-top'));
    const topMesh = topFace?.children.find((child) => child.id.endsWith('-top-mesh'));
    expect(
      result.components.some((component) => component.type === COMPONENT_TYPES.BOX_COLLIDER)
    ).toBe(false);
    expect(topFace?.rotation).toEqual({ x: 90, y: 0, z: 0 });
    expect(topMesh?.rotation.x).toBeCloseTo(45, 4);
    expect(topFace?.position.y).toBe(0);
    const topMeshQuad = topMesh?.components.find(
      (component) => component.type === COMPONENT_TYPES.QUAD_MESH
    );
    expect(topMeshQuad?.fields).toEqual({
      Size: { $type: 'float2', value: { x: 2, y: 2.8284 } },
    });
    const topMeshCollider = topMesh?.components.find(
      (component) => component.type === COMPONENT_TYPES.BOX_COLLIDER
    );
    const topMeshColliderSize = topMeshCollider?.fields.Size as
      | { value?: { x?: number; y?: number; z?: number } }
      | undefined;
    expect(topMeshColliderSize?.value?.x).toBe(2);
    expect(topMeshColliderSize?.value?.y).toBeCloseTo(2.8284, 4);
    expect(topMeshColliderSize?.value?.z).toBe(0.01);
    const topMeshMaterial = topMesh?.components.find(
      (component) => component.type === COMPONENT_TYPES.XIEXE_TOON_MATERIAL
    );
    expect(topMeshMaterial?.fields.Culling).toEqual({
      $type: 'enum',
      value: 'Off',
      enumType: 'Culling',
    });
    const leftWall = result.children.find((child) => child.id.endsWith('-left'));
    const rightWall = result.children.find((child) => child.id.endsWith('-right'));
    expect(
      leftWall?.components.some((component) => component.type === COMPONENT_TYPES.TRIANGLE_MESH)
    ).toBe(true);
    expect(
      leftWall?.components.some((component) => component.type === COMPONENT_TYPES.TRIANGLE_COLLIDER)
    ).toBe(true);
    expect(
      rightWall?.components.some((component) => component.type === COMPONENT_TYPES.TRIANGLE_MESH)
    ).toBe(true);
    expect(
      rightWall?.components.some(
        (component) => component.type === COMPONENT_TYPES.TRIANGLE_COLLIDER
      )
    ).toBe(true);
    expect(result.children.some((child) => child.id.endsWith('-back'))).toBe(false);
    expect(result.children.some((child) => child.id.endsWith('-front'))).toBe(true);
  });

  it('uses half-height Y offset when mode=1 and slope is enabled', () => {
    const udonObj: Terrain = {
      id: 'terrain-slope-mode1',
      type: 'terrain',
      isLocked: true,
      mode: 1,
      rotate: 0,
      name: 'Slope Mode1',
      position: { x: 0, y: 0, z: 100 },
      images: [],
      width: 1,
      height: 7,
      depth: 1,
      wallImage: null,
      floorImage: null,
    };

    const result = convertTerrain(
      udonObj,
      { x: 0, y: 2, z: 0 },
      buildImageAssetContext(),
      undefined,
      'slot-terrain-slope-mode1',
      { altitude: 0, isSlope: true, slopeDirection: 1 }
    );

    expect(result.position.y).toBe(5.5);
  });

  it('removes front/left/right wall and adjusts slope size for BOTTOM/LEFT/RIGHT', () => {
    const baseTerrain: Terrain = {
      id: 'terrain-slope',
      type: 'terrain',
      isLocked: true,
      mode: 3,
      rotate: 0,
      name: 'Slope',
      position: { x: 0, y: 0, z: 0 },
      images: [],
      width: 2,
      height: 2,
      depth: 2,
      wallImage: null,
      floorImage: null,
    };

    const bottom = convertTerrain(
      baseTerrain,
      { x: 0, y: 0, z: 0 },
      buildImageAssetContext(),
      undefined,
      'slot-terrain-slope-bottom',
      { altitude: 0, isSlope: true, slopeDirection: 2 }
    );
    const bottomTop = bottom.children.find((child) => child.id.endsWith('-top'));
    const bottomTopMesh = bottomTop?.children.find((child) => child.id.endsWith('-top-mesh'));
    expect(
      bottom.components.some((component) => component.type === COMPONENT_TYPES.BOX_COLLIDER)
    ).toBe(false);
    expect(bottomTopMesh?.rotation.x).toBeCloseTo(-45, 4);
    expect(bottom.children.some((child) => child.id.endsWith('-front'))).toBe(false);
    expect(
      bottom.children
        .find((child) => child.id.endsWith('-left'))
        ?.components.some((component) => component.type === COMPONENT_TYPES.TRIANGLE_MESH)
    ).toBe(true);
    expect(
      bottom.children
        .find((child) => child.id.endsWith('-left'))
        ?.components.some((component) => component.type === COMPONENT_TYPES.TRIANGLE_COLLIDER)
    ).toBe(true);
    expect(
      bottom.children
        .find((child) => child.id.endsWith('-right'))
        ?.components.some((component) => component.type === COMPONENT_TYPES.TRIANGLE_MESH)
    ).toBe(true);
    expect(
      bottom.children
        .find((child) => child.id.endsWith('-right'))
        ?.components.some((component) => component.type === COMPONENT_TYPES.TRIANGLE_COLLIDER)
    ).toBe(true);

    const left = convertTerrain(
      baseTerrain,
      { x: 0, y: 0, z: 0 },
      buildImageAssetContext(),
      undefined,
      'slot-terrain-slope-left',
      { altitude: 0, isSlope: true, slopeDirection: 3 }
    );
    const leftTop = left.children.find((child) => child.id.endsWith('-top'));
    const leftTopMesh = leftTop?.children.find((child) => child.id.endsWith('-top-mesh'));
    expect(leftTopMesh?.rotation.y).toBeCloseTo(45, 4);
    const leftTopQuad = leftTopMesh?.components.find(
      (component) => component.type === COMPONENT_TYPES.QUAD_MESH
    );
    expect(leftTopQuad?.fields).toEqual({
      Size: { $type: 'float2', value: { x: 2.8284, y: 2 } },
    });
    expect(left.children.some((child) => child.id.endsWith('-left'))).toBe(false);
    expect(
      left.children
        .find((child) => child.id.endsWith('-front'))
        ?.components.some((component) => component.type === COMPONENT_TYPES.TRIANGLE_MESH)
    ).toBe(true);
    expect(
      left.children
        .find((child) => child.id.endsWith('-back'))
        ?.components.some((component) => component.type === COMPONENT_TYPES.TRIANGLE_MESH)
    ).toBe(true);
    expect(left.children.find((child) => child.id.endsWith('-back'))?.scale).toEqual({
      x: -1,
      y: 1,
      z: 1,
    });
    const leftBackTriangle = left.children
      .find((child) => child.id.endsWith('-back'))
      ?.components.find((component) => component.type === COMPONENT_TYPES.TRIANGLE_MESH) as {
      fields?: { Vertex2?: { members?: { Position?: { value?: { x?: number } } } } };
    };
    expect(leftBackTriangle.fields?.Vertex2?.members?.Position?.value?.x).toBe(1);
    const leftBackCollider = left.children
      .find((child) => child.id.endsWith('-back'))
      ?.components.find((component) => component.type === COMPONENT_TYPES.TRIANGLE_COLLIDER) as {
      fields?: { B?: { value?: { y?: number } }; C?: { value?: { y?: number } } };
    };
    expect(leftBackCollider.fields?.B?.value?.y).toBe(1);
    expect(leftBackCollider.fields?.C?.value?.y).toBe(-1);

    const right = convertTerrain(
      baseTerrain,
      { x: 0, y: 0, z: 0 },
      buildImageAssetContext(),
      undefined,
      'slot-terrain-slope-right',
      { altitude: 0, isSlope: true, slopeDirection: 4 }
    );
    const rightTop = right.children.find((child) => child.id.endsWith('-top'));
    const rightTopMesh = rightTop?.children.find((child) => child.id.endsWith('-top-mesh'));
    expect(rightTopMesh?.rotation.y).toBeCloseTo(-45, 4);
    expect(right.children.some((child) => child.id.endsWith('-right'))).toBe(false);
    expect(
      right.children
        .find((child) => child.id.endsWith('-front'))
        ?.components.some((component) => component.type === COMPONENT_TYPES.TRIANGLE_MESH)
    ).toBe(true);
    expect(
      right.children
        .find((child) => child.id.endsWith('-back'))
        ?.components.some((component) => component.type === COMPONENT_TYPES.TRIANGLE_MESH)
    ).toBe(true);
    expect(right.children.find((child) => child.id.endsWith('-back'))?.scale).toEqual({
      x: -1,
      y: 1,
      z: 1,
    });
    const rightBackTriangle = right.children
      .find((child) => child.id.endsWith('-back'))
      ?.components.find((component) => component.type === COMPONENT_TYPES.TRIANGLE_MESH) as {
      fields?: { Vertex2?: { members?: { Position?: { value?: { x?: number } } } } };
    };
    expect(rightBackTriangle.fields?.Vertex2?.members?.Position?.value?.x).toBe(-1);
    const rightBackCollider = right.children
      .find((child) => child.id.endsWith('-back'))
      ?.components.find((component) => component.type === COMPONENT_TYPES.TRIANGLE_COLLIDER) as {
      fields?: { B?: { value?: { y?: number } }; C?: { value?: { y?: number } } };
    };
    expect(rightBackCollider.fields?.B?.value?.y).toBe(1);
    expect(rightBackCollider.fields?.C?.value?.y).toBe(-1);
    expect(bottom.children.find((child) => child.id.endsWith('-left'))?.scale).toEqual({
      x: -1,
      y: 1,
      z: 1,
    });
    const bottomLeftTriangle = bottom.children
      .find((child) => child.id.endsWith('-left'))
      ?.components.find((component) => component.type === COMPONENT_TYPES.TRIANGLE_MESH) as {
      fields?: { Vertex2?: { members?: { Position?: { value?: { x?: number } } } } };
    };
    expect(bottomLeftTriangle.fields?.Vertex2?.members?.Position?.value?.x).toBe(1);
    const bottomLeftCollider = bottom.children
      .find((child) => child.id.endsWith('-left'))
      ?.components.find((component) => component.type === COMPONENT_TYPES.TRIANGLE_COLLIDER) as {
      fields?: { B?: { value?: { y?: number } }; C?: { value?: { y?: number } } };
    };
    expect(bottomLeftCollider.fields?.B?.value?.y).toBe(1);
    expect(bottomLeftCollider.fields?.C?.value?.y).toBe(-1);
  });
});
