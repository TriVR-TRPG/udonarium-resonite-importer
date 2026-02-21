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
  terrainLilyExtension: TerrainLilyExtension | undefined
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
  terrainLilyExtension: TerrainLilyExtension | undefined
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
  terrainLilyExtension: TerrainLilyExtension | undefined
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

function buildWallSlot(
  id: string,
  name: string,
  position: Vector3,
  rotation: Vector3,
  size: { x: number; y: number },
  textureIdentifier: string | undefined,
  imageAssetContext: ImageAssetContext,
  scale?: Vector3
): ResoniteObject {
  const builder = ResoniteObjectBuilder.create({ id, name })
    .setPosition(position)
    .setRotation(rotation);
  if (scale) {
    builder.setScale(scale);
  }
  return builder
    .addQuadMesh({
      textureIdentifier,
      dualSided: false,
      size,
      imageAssetContext,
    })
    .build();
}

export function convertTerrain(
  udonObj: Terrain,
  basePosition: Vector3,
  imageAssetContext: ImageAssetContext,
  options?: { enableCharacterColliderOnLockedTerrain?: boolean },
  slotId?: string,
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
    id: slotId,
    name: udonObj.name,
  })
    .setRotation({ x: 0, y: udonObj.rotate, z: 0 })
    .setSourceType(udonObj.type);

  const topId = `${mainBuilder.getId()}-top`;
  const bottomId = `${mainBuilder.getId()}-bottom`;
  const topBackId = `${mainBuilder.getId()}-top-back`;
  const frontId = `${mainBuilder.getId()}-front`;
  const backId = `${mainBuilder.getId()}-back`;
  const leftId = `${mainBuilder.getId()}-left`;
  const rightId = `${mainBuilder.getId()}-right`;
  const hideWalls = udonObj.mode === 1;
  const altitude = terrainLilyExtension?.altitude ?? 0;
  const isSlope = terrainLilyExtension?.isSlope ?? false;
  const topSurfaceSize = getTopSurfaceSize(udonObj, terrainLilyExtension);
  const topSurfaceY = getTopSurfaceY(udonObj, hideWalls, isSlope);
  const topBaseRotation = { x: 90, y: 0, z: 0 };
  const topTiltRotation = getSlopeTopTiltRotation(udonObj, terrainLilyExtension);
  const topMeshId = `${topId}-mesh`;
  mainBuilder.setPosition({
    x: basePosition.x + udonObj.width / 2,
    y: basePosition.y + altitude + (hideWalls ? udonObj.height : udonObj.height / 2),
    z: basePosition.z - udonObj.depth / 2,
  });

  const topSurface = ResoniteObjectBuilder.create({
    id: topId,
    name: `${udonObj.name}-top`,
  })
    .setPosition({ x: 0, y: topSurfaceY, z: 0 })
    .setRotation(topBaseRotation);
  if (isSlope) {
    topSurface.addChild(
      ResoniteObjectBuilder.create({
        id: topMeshId,
        name: `${udonObj.name}-top-mesh`,
      })
        .setPosition({ x: 0, y: 0, z: 0 })
        .setRotation(topTiltRotation)
        .addQuadMesh({
          textureIdentifier: topTextureIdentifier,
          dualSided: false,
          size: topSurfaceSize,
          imageAssetContext,
        })
        .build()
    );
  } else {
    topSurface.addQuadMesh({
      textureIdentifier: topTextureIdentifier,
      dualSided: false,
      size: topSurfaceSize,
      imageAssetContext,
    });
  }
  const builtTopSurface = topSurface.build();
  const topBottomSize = { x: udonObj.width, y: udonObj.depth };
  const bottomLikeSurface = ResoniteObjectBuilder.create({
    id: hideWalls ? topBackId : bottomId,
    name: hideWalls ? `${udonObj.name}-top-back` : `${udonObj.name}-bottom`,
  })
    .setPosition({ x: 0, y: hideWalls ? 0 : -udonObj.height / 2, z: 0 })
    .setRotation({ x: -90, y: 0, z: 0 })
    .setScale(hideWalls ? undefined : { x: 1, y: -1, z: 1 })
    .addQuadMesh({
      textureIdentifier: topTextureIdentifier,
      dualSided: false,
      size: topBottomSize,
      imageAssetContext,
    })
    .build();

  mainBuilder.addBoxCollider(
    { x: udonObj.width, y: hideWalls ? 0 : udonObj.height, z: udonObj.depth },
    {
      characterCollider:
        udonObj.isLocked && (options?.enableCharacterColliderOnLockedTerrain ?? true),
    }
  );

  if (!udonObj.isLocked) {
    mainBuilder.addGrabbable();
  }

  if (hasPositiveSize(topBottomSize)) {
    mainBuilder.addChild(builtTopSurface);
    mainBuilder.addChild(bottomLikeSurface);
  }
  if (!hideWalls) {
    const frontBackSize = { x: udonObj.width, y: udonObj.height };
    const leftRightSize = { x: udonObj.depth, y: udonObj.height };

    if (hasPositiveSize(frontBackSize) && !shouldSkipWall('front', terrainLilyExtension)) {
      mainBuilder.addChild(
        buildWallSlot(
          frontId,
          `${udonObj.name}-front`,
          { x: 0, y: 0, z: -udonObj.depth / 2 },
          { x: 0, y: 0, z: 0 },
          frontBackSize,
          sideTextureIdentifier,
          imageAssetContext
        )
      );
    }
    if (hasPositiveSize(frontBackSize) && !shouldSkipWall('back', terrainLilyExtension)) {
      mainBuilder.addChild(
        buildWallSlot(
          backId,
          `${udonObj.name}-back`,
          { x: 0, y: 0, z: udonObj.depth / 2 },
          { x: 0, y: 180, z: 0 },
          frontBackSize,
          sideTextureIdentifier,
          imageAssetContext,
          { x: -1, y: 1, z: 1 }
        )
      );
    }

    if (hasPositiveSize(leftRightSize) && !shouldSkipWall('left', terrainLilyExtension)) {
      mainBuilder.addChild(
        buildWallSlot(
          leftId,
          `${udonObj.name}-left`,
          { x: -udonObj.width / 2, y: 0, z: 0 },
          { x: 0, y: 90, z: 0 },
          leftRightSize,
          sideTextureIdentifier,
          imageAssetContext,
          { x: -1, y: 1, z: 1 }
        )
      );
    }
    if (hasPositiveSize(leftRightSize) && !shouldSkipWall('right', terrainLilyExtension)) {
      mainBuilder.addChild(
        buildWallSlot(
          rightId,
          `${udonObj.name}-right`,
          { x: udonObj.width / 2, y: 0, z: 0 },
          { x: 0, y: -90, z: 0 },
          leftRightSize,
          sideTextureIdentifier,
          imageAssetContext
        )
      );
    }
  }

  return mainBuilder.build();
}
