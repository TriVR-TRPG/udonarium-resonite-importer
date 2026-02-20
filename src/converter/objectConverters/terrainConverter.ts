import { Terrain } from '../../domain/UdonariumObject';
import { ImageBlendMode } from '../../config/MappingConfig';
import { ResoniteObject, Vector3 } from '../../domain/ResoniteObject';
import { ResoniteObjectBuilder } from '../ResoniteObjectBuilder';

function buildWallSlot(
  id: string,
  name: string,
  position: Vector3,
  rotation: Vector3,
  size: { x: number; y: number },
  textureIdentifier: string | undefined,
  textureMap?: Map<string, string>,
  imageBlendModeMap?: Map<string, ImageBlendMode>
): ResoniteObject {
  return ResoniteObjectBuilder.create({ id, name })
    .setPosition(position)
    .setRotation(rotation)
    .addQuadMesh({
      textureIdentifier,
      dualSided: false,
      size,
      imageBlendModeMap,
      textureMap,
    })
    .build();
}

export function convertTerrain(
  udonObj: Terrain,
  basePosition: Vector3,
  textureMap?: Map<string, string>,
  imageBlendModeMap?: Map<string, ImageBlendMode>,
  slotId?: string,
  options?: { enableCharacterColliderOnLockedTerrain?: boolean }
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
  const wallsId = `${mainBuilder.getId()}-walls`;
  const frontId = `${wallsId}-front`;
  const backId = `${wallsId}-back`;
  const leftId = `${wallsId}-left`;
  const rightId = `${wallsId}-right`;
  const hideWalls = udonObj.mode === 1;
  mainBuilder.setPosition({
    x: basePosition.x + udonObj.width / 2,
    y: basePosition.y + (hideWalls ? udonObj.height : udonObj.height / 2),
    z: basePosition.z - udonObj.depth / 2,
  });

  const topSurface = ResoniteObjectBuilder.create({
    id: topId,
    name: `${udonObj.name}-top`,
  })
    .setPosition({ x: 0, y: hideWalls ? 0 : udonObj.height / 2, z: 0 })
    .setRotation({ x: 90, y: 0, z: 0 })
    .addQuadMesh({
      textureIdentifier: topTextureIdentifier,
      dualSided: false,
      size: { x: udonObj.width, y: udonObj.depth },
      imageBlendModeMap,
      textureMap,
    })
    .build();
  const bottomLikeSurface = ResoniteObjectBuilder.create({
    id: hideWalls ? topBackId : bottomId,
    name: hideWalls ? `${udonObj.name}-top-back` : `${udonObj.name}-bottom`,
  })
    .setPosition({ x: 0, y: hideWalls ? 0 : -udonObj.height / 2, z: 0 })
    .setRotation({ x: -90, y: 0, z: 0 })
    .addQuadMesh({
      textureIdentifier: topTextureIdentifier,
      dualSided: false,
      size: { x: udonObj.width, y: udonObj.depth },
      imageBlendModeMap,
      textureMap,
    })
    .build();

  const wallsContainer = ResoniteObjectBuilder.create({
    id: wallsId,
    name: `${udonObj.name}-walls`,
  })
    .setPosition({ x: 0, y: 0, z: 0 })
    .setRotation({ x: 0, y: 0, z: 0 })
    .setActive(!hideWalls)
    .addChild(
      buildWallSlot(
        frontId,
        `${udonObj.name}-front`,
        { x: 0, y: 0, z: -udonObj.depth / 2 },
        { x: 0, y: 0, z: 0 },
        { x: udonObj.width, y: udonObj.height },
        sideTextureIdentifier,
        textureMap,
        imageBlendModeMap
      )
    )
    .addChild(
      buildWallSlot(
        backId,
        `${udonObj.name}-back`,
        { x: 0, y: 0, z: udonObj.depth / 2 },
        { x: 0, y: 180, z: 0 },
        { x: udonObj.width, y: udonObj.height },
        sideTextureIdentifier,
        textureMap,
        imageBlendModeMap
      )
    )
    .addChild(
      buildWallSlot(
        leftId,
        `${udonObj.name}-left`,
        { x: -udonObj.width / 2, y: 0, z: 0 },
        { x: 0, y: 90, z: 0 },
        { x: udonObj.depth, y: udonObj.height },
        sideTextureIdentifier,
        textureMap,
        imageBlendModeMap
      )
    )
    .addChild(
      buildWallSlot(
        rightId,
        `${udonObj.name}-right`,
        { x: udonObj.width / 2, y: 0, z: 0 },
        { x: 0, y: -90, z: 0 },
        { x: udonObj.depth, y: udonObj.height },
        sideTextureIdentifier,
        textureMap,
        imageBlendModeMap
      )
    )
    .build();

  // Axis mapping: width -> X, height -> Y, depth -> Z
  // Udonarium positions are edge-based; Resonite uses center-based transforms.
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

  mainBuilder.addChild(topSurface);
  mainBuilder.addChild(bottomLikeSurface);
  if (!hideWalls) {
    mainBuilder.addChild(wallsContainer);
  }

  return mainBuilder.build();
}
