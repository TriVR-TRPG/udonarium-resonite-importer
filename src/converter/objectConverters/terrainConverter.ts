import { Terrain } from '../../domain/UdonariumObject';
import { ResoniteObject, Vector3 } from '../../domain/ResoniteObject';
import { ResoniteObjectBuilder } from '../ResoniteObjectBuilder';
import { ImageAssetContext } from '../imageAssetContext';
import { TerrainLilyExtension } from '../../parser/extensions/ObjectExtensions';

const SLOPE_DIRECTION = {
  NONE: 0,
  TOP: 1,
  BOTTOM: 2,
  LEFT: 3,
  RIGHT: 4,
} as const;

function hasPositiveSize(size: { x: number; y: number }): boolean {
  return size.x > 0 && size.y > 0;
}

function toDegrees(radian: number): number {
  return (radian * 180) / Math.PI;
}

function getSlopeAngle(height: number, horizontalLength: number): number {
  if (height <= 0 || horizontalLength <= 0) {
    return 0;
  }
  return toDegrees(Math.atan2(height, horizontalLength));
}

function getSlopeTopTiltRotation(
  udonObj: Terrain,
  terrainLilyExtension?: TerrainLilyExtension
): Vector3 {
  if (!terrainLilyExtension?.isSlope) {
    return { x: 0, y: 0, z: 0 };
  }

  switch (terrainLilyExtension.slopeDirection) {
    case SLOPE_DIRECTION.TOP: {
      const angle = getSlopeAngle(udonObj.height, udonObj.depth);
      return { x: angle, y: 0, z: 0 };
    }
    case SLOPE_DIRECTION.BOTTOM: {
      const angle = getSlopeAngle(udonObj.height, udonObj.depth);
      return { x: -angle, y: 0, z: 0 };
    }
    case SLOPE_DIRECTION.LEFT: {
      const angle = getSlopeAngle(udonObj.height, udonObj.width);
      return { x: 0, y: angle, z: 0 };
    }
    case SLOPE_DIRECTION.RIGHT: {
      const angle = getSlopeAngle(udonObj.height, udonObj.width);
      return { x: 0, y: -angle, z: 0 };
    }
    default:
      return { x: 0, y: 0, z: 0 };
  }
}

function getTopSurfaceSize(
  udonObj: Terrain,
  terrainLilyExtension?: TerrainLilyExtension
): { x: number; y: number } {
  if (!terrainLilyExtension?.isSlope) {
    return { x: udonObj.width, y: udonObj.depth };
  }
  switch (terrainLilyExtension.slopeDirection) {
    case SLOPE_DIRECTION.TOP:
    case SLOPE_DIRECTION.BOTTOM:
      return { x: udonObj.width, y: Math.hypot(udonObj.depth, udonObj.height) };
    case SLOPE_DIRECTION.LEFT:
    case SLOPE_DIRECTION.RIGHT:
      return { x: Math.hypot(udonObj.width, udonObj.height), y: udonObj.depth };
    default:
      return { x: udonObj.width, y: udonObj.depth };
  }
}

function getTopSurfaceY(udonObj: Terrain, hideWalls: boolean, isSlope: boolean): number {
  if (hideWalls) {
    return 0;
  }
  if (isSlope) {
    return 0;
  }
  return udonObj.height / 2;
}

function shouldSkipWall(
  wall: 'front' | 'back' | 'left' | 'right',
  terrainLilyExtension?: TerrainLilyExtension
): boolean {
  if (!terrainLilyExtension?.isSlope) {
    return false;
  }

  switch (terrainLilyExtension.slopeDirection) {
    case SLOPE_DIRECTION.TOP:
      return wall === 'back';
    case SLOPE_DIRECTION.BOTTOM:
      return wall === 'front';
    case SLOPE_DIRECTION.LEFT:
      return wall === 'left';
    case SLOPE_DIRECTION.RIGHT:
      return wall === 'right';
    default:
      return false;
  }
}

function isTriangleWall(
  wall: 'front' | 'back' | 'left' | 'right',
  terrainLilyExtension?: TerrainLilyExtension
): boolean {
  if (!terrainLilyExtension?.isSlope) {
    return false;
  }

  switch (terrainLilyExtension.slopeDirection) {
    case SLOPE_DIRECTION.TOP:
    case SLOPE_DIRECTION.BOTTOM:
      return wall === 'left' || wall === 'right';
    case SLOPE_DIRECTION.LEFT:
    case SLOPE_DIRECTION.RIGHT:
      return wall === 'front' || wall === 'back';
    default:
      return false;
  }
}

function getTriangleSlopeSign(
  wall: 'front' | 'back' | 'left' | 'right',
  terrainLilyExtension?: TerrainLilyExtension
): number {
  if (!terrainLilyExtension?.isSlope) {
    return 1;
  }

  switch (terrainLilyExtension.slopeDirection) {
    case SLOPE_DIRECTION.TOP:
      return wall === 'left' ? 1 : -1;
    case SLOPE_DIRECTION.BOTTOM:
      return wall === 'left' ? -1 : 1;
    case SLOPE_DIRECTION.LEFT:
      return wall === 'front' ? 1 : -1;
    case SLOPE_DIRECTION.RIGHT:
      return wall === 'front' ? -1 : 1;
    default:
      return 1;
  }
}

function buildWallSlot(
  id: string,
  name: string,
  position: Vector3,
  rotation: Vector3,
  size: { x: number; y: number },
  imageAssetContext: ImageAssetContext,
  textureIdentifier?: string,
  colliderOptions?: { enabled: boolean; characterCollider: boolean },
  scale?: Vector3
): ResoniteObject {
  const builder = ResoniteObjectBuilder.create({ id, name })
    .setPosition(position)
    .setRotation(rotation);
  if (scale) {
    builder.setScale(scale);
  }
  if (colliderOptions?.enabled) {
    builder.addBoxCollider(
      {
        x: size.x,
        y: size.y,
        z: 0.01,
      },
      {
        characterCollider: colliderOptions.characterCollider,
      }
    );
  }
  return builder
    .addQuadMesh({
      ...(textureIdentifier != null ? { textureIdentifier } : {}),
      dualSided: false,
      size,
      imageAssetContext,
    })
    .build();
}

function buildTriangleWallSlot(
  id: string,
  name: string,
  position: Vector3,
  rotation: Vector3,
  size: { x: number; y: number },
  slopeSign: number,
  imageAssetContext: ImageAssetContext,
  textureIdentifier?: string,
  colliderOptions?: { enabled: boolean; characterCollider: boolean },
  scale?: Vector3
): ResoniteObject {
  const halfX = size.x / 2;
  const halfY = size.y / 2;
  const adjustedSlopeSign = scale?.x && scale.x < 0 ? -slopeSign : slopeSign;
  const peakX = adjustedSlopeSign >= 0 ? halfX : -halfX;

  const builder = ResoniteObjectBuilder.create({ id, name })
    .setPosition(position)
    .setRotation(rotation);
  if (scale) {
    builder.setScale(scale);
  }
  const vertices: [
    { x: number; y: number; z: number },
    { x: number; y: number; z: number },
    { x: number; y: number; z: number },
  ] = [
    { x: -halfX, y: -halfY, z: 0 },
    { x: halfX, y: -halfY, z: 0 },
    { x: peakX, y: halfY, z: 0 },
  ];
  if (colliderOptions?.enabled) {
    builder.addTriangleCollider(vertices, {
      characterCollider: colliderOptions.characterCollider,
    });
  }
  return builder
    .addTriangleMesh({
      ...(textureIdentifier != null ? { textureIdentifier } : {}),
      imageAssetContext,
      dualSided: true,
      vertices,
    })
    .build();
}

export function convertTerrain(
  udonObj: Terrain,
  basePosition: Vector3,
  imageAssetContext: ImageAssetContext,
  options?: { enableCharacterColliderOnLockedTerrain?: boolean },
  slotId?: string | null,
  terrainLilyExtension?: TerrainLilyExtension
): ResoniteObject {
  const topTextureIdentifier =
    udonObj.floorImage?.identifier ??
    udonObj.wallImage?.identifier ??
    udonObj.images[0]?.identifier;
  const sideTextureIdentifier =
    udonObj.wallImage?.identifier ??
    udonObj.floorImage?.identifier ??
    udonObj.images[0]?.identifier;

  const mainBuilder = ResoniteObjectBuilder.create({
    ...(slotId != null ? { id: slotId } : {}),
    name: udonObj.name,
  })
    .setRotation({ x: 0, y: udonObj.rotate, z: 0 })
    .setSourceType(udonObj.type);

  const topId = `${mainBuilder.getId()}-top`;
  const frontId = `${mainBuilder.getId()}-front`;
  const backId = `${mainBuilder.getId()}-back`;
  const leftId = `${mainBuilder.getId()}-left`;
  const rightId = `${mainBuilder.getId()}-right`;
  const hideWalls = udonObj.mode === 1;
  const altitude = terrainLilyExtension?.altitude ?? 0;
  const isSlope = terrainLilyExtension?.isSlope ?? false;
  const slopeCharacterCollider =
    isSlope && udonObj.isLocked && (options?.enableCharacterColliderOnLockedTerrain ?? true);
  const topSurfaceSize = getTopSurfaceSize(udonObj, terrainLilyExtension);
  const topSurfaceY = getTopSurfaceY(udonObj, hideWalls, isSlope);
  const topBaseRotation = { x: 90, y: 0, z: 0 };
  const topTiltRotation = getSlopeTopTiltRotation(udonObj, terrainLilyExtension);
  const topMeshId = `${topId}-mesh`;
  mainBuilder.setPosition({
    x: basePosition.x + udonObj.width / 2,
    y: basePosition.y + altitude + (hideWalls && !isSlope ? udonObj.height : udonObj.height / 2),
    z: basePosition.z - udonObj.depth / 2,
  });

  const topSurface = ResoniteObjectBuilder.create({
    id: topId,
    name: `${udonObj.name}-top`,
  })
    .setPosition({ x: 0, y: topSurfaceY, z: 0 })
    .setRotation(topBaseRotation);
  if (isSlope) {
    const topMeshBuilder = ResoniteObjectBuilder.create({
      id: topMeshId,
      name: `${udonObj.name}-top-mesh`,
    })
      .setPosition({ x: 0, y: 0, z: 0 })
      .setRotation(topTiltRotation)
      .addBoxCollider(
        {
          x: topSurfaceSize.x,
          y: topSurfaceSize.y,
          z: 0.01,
        },
        {
          characterCollider: slopeCharacterCollider,
        }
      )
      .addQuadMesh({
        ...(topTextureIdentifier != null ? { textureIdentifier: topTextureIdentifier } : {}),
        dualSided: true,
        size: topSurfaceSize,
        imageAssetContext,
      });
    topSurface.addChild(topMeshBuilder.build());
  } else {
    topSurface.addQuadMesh({
      ...(topTextureIdentifier != null ? { textureIdentifier: topTextureIdentifier } : {}),
      dualSided: true,
      size: topSurfaceSize,
      imageAssetContext,
    });
  }
  const builtTopSurface = topSurface.build();
  const topBottomSize = { x: udonObj.width, y: udonObj.depth };

  if (!isSlope) {
    mainBuilder.addBoxCollider(
      { x: udonObj.width, y: hideWalls ? 0 : udonObj.height, z: udonObj.depth },
      {
        characterCollider:
          udonObj.isLocked && (options?.enableCharacterColliderOnLockedTerrain ?? true),
      }
    );
  }

  if (!udonObj.isLocked) {
    mainBuilder.addGrabbable();
  }

  if (hasPositiveSize(topBottomSize)) {
    mainBuilder.addChild(builtTopSurface);
  }
  if (!hideWalls) {
    const frontBackSize = { x: udonObj.width, y: udonObj.height };
    const leftRightSize = { x: udonObj.depth, y: udonObj.height };

    if (hasPositiveSize(frontBackSize) && !shouldSkipWall('front', terrainLilyExtension)) {
      const useTriangle = isTriangleWall('front', terrainLilyExtension);
      mainBuilder.addChild(
        useTriangle
          ? buildTriangleWallSlot(
              frontId,
              `${udonObj.name}-front`,
              { x: 0, y: 0, z: -udonObj.depth / 2 },
              { x: 0, y: 0, z: 0 },
              frontBackSize,
              getTriangleSlopeSign('front', terrainLilyExtension),
              imageAssetContext,
              sideTextureIdentifier,
              {
                enabled: isSlope,
                characterCollider: slopeCharacterCollider,
              }
            )
          : buildWallSlot(
              frontId,
              `${udonObj.name}-front`,
              { x: 0, y: 0, z: -udonObj.depth / 2 },
              { x: 0, y: 0, z: 0 },
              frontBackSize,
              imageAssetContext,
              sideTextureIdentifier,
              {
                enabled: isSlope,
                characterCollider: slopeCharacterCollider,
              }
            )
      );
    }
    if (hasPositiveSize(frontBackSize) && !shouldSkipWall('back', terrainLilyExtension)) {
      const useTriangle = isTriangleWall('back', terrainLilyExtension);
      mainBuilder.addChild(
        useTriangle
          ? buildTriangleWallSlot(
              backId,
              `${udonObj.name}-back`,
              { x: 0, y: 0, z: udonObj.depth / 2 },
              { x: 0, y: 180, z: 0 },
              frontBackSize,
              getTriangleSlopeSign('back', terrainLilyExtension),
              imageAssetContext,
              sideTextureIdentifier,
              {
                enabled: isSlope,
                characterCollider: slopeCharacterCollider,
              },
              { x: -1, y: 1, z: 1 }
            )
          : buildWallSlot(
              backId,
              `${udonObj.name}-back`,
              { x: 0, y: 0, z: udonObj.depth / 2 },
              { x: 0, y: 180, z: 0 },
              frontBackSize,
              imageAssetContext,
              sideTextureIdentifier,
              {
                enabled: isSlope,
                characterCollider: slopeCharacterCollider,
              },
              { x: -1, y: 1, z: 1 }
            )
      );
    }

    if (hasPositiveSize(leftRightSize) && !shouldSkipWall('left', terrainLilyExtension)) {
      const useTriangle = isTriangleWall('left', terrainLilyExtension);
      mainBuilder.addChild(
        useTriangle
          ? buildTriangleWallSlot(
              leftId,
              `${udonObj.name}-left`,
              { x: -udonObj.width / 2, y: 0, z: 0 },
              { x: 0, y: 90, z: 0 },
              leftRightSize,
              getTriangleSlopeSign('left', terrainLilyExtension),
              imageAssetContext,
              sideTextureIdentifier,
              {
                enabled: isSlope,
                characterCollider: slopeCharacterCollider,
              },
              { x: -1, y: 1, z: 1 }
            )
          : buildWallSlot(
              leftId,
              `${udonObj.name}-left`,
              { x: -udonObj.width / 2, y: 0, z: 0 },
              { x: 0, y: 90, z: 0 },
              leftRightSize,
              imageAssetContext,
              sideTextureIdentifier,
              {
                enabled: isSlope,
                characterCollider: slopeCharacterCollider,
              },
              { x: -1, y: 1, z: 1 }
            )
      );
    }
    if (hasPositiveSize(leftRightSize) && !shouldSkipWall('right', terrainLilyExtension)) {
      const useTriangle = isTriangleWall('right', terrainLilyExtension);
      mainBuilder.addChild(
        useTriangle
          ? buildTriangleWallSlot(
              rightId,
              `${udonObj.name}-right`,
              { x: udonObj.width / 2, y: 0, z: 0 },
              { x: 0, y: -90, z: 0 },
              leftRightSize,
              getTriangleSlopeSign('right', terrainLilyExtension),
              imageAssetContext,
              sideTextureIdentifier,
              {
                enabled: isSlope,
                characterCollider: slopeCharacterCollider,
              }
            )
          : buildWallSlot(
              rightId,
              `${udonObj.name}-right`,
              { x: udonObj.width / 2, y: 0, z: 0 },
              { x: 0, y: -90, z: 0 },
              leftRightSize,
              imageAssetContext,
              sideTextureIdentifier,
              {
                enabled: isSlope,
                characterCollider: slopeCharacterCollider,
              }
            )
      );
    }
  }

  return mainBuilder.build();
}
