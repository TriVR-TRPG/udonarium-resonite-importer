import { Terrain } from '../../domain/UdonariumObject';
import { ImageBlendMode } from '../../config/MappingConfig';
import { ResoniteObject, Vector3 } from '../../domain/ResoniteObject';
import { BlendModeValue, resolveTextureValue } from '../textureUtils';
import { lookupImageBlendMode } from '../imageAspectRatioMap';
import { ResoniteObjectBuilder } from '../ResoniteObjectBuilder';

function resolveBlendMode(
  identifier: string | undefined,
  imageBlendModeMap?: Map<string, ImageBlendMode>
): BlendModeValue {
  if (!imageBlendModeMap) {
    return 'Opaque';
  }
  return lookupImageBlendMode(imageBlendModeMap, identifier) ?? 'Opaque';
}

function buildWallSlot(
  id: string,
  name: string,
  position: Vector3,
  rotation: Vector3,
  size: { x: number; y: number },
  textureValue: string | undefined,
  blendMode: BlendModeValue
): ResoniteObject {
  return ResoniteObjectBuilder.create({ id, name })
    .setPosition(position)
    .setRotation(rotation)
    .addQuadMesh(textureValue, false, size, blendMode)
    .build();
}

export function convertTerrain(
  udonObj: Terrain,
  basePosition: Vector3,
  textureMap?: Map<string, string>,
  imageBlendModeMap?: Map<string, ImageBlendMode>,
  slotId?: string
): ResoniteObject {
  const topTextureIdentifier =
    udonObj.floorImage?.identifier ??
    udonObj.wallImage?.identifier ??
    udonObj.images[0]?.identifier;
  const sideTextureIdentifier =
    udonObj.wallImage?.identifier ??
    udonObj.floorImage?.identifier ??
    udonObj.images[0]?.identifier;
  const topTextureValue = resolveTextureValue(topTextureIdentifier, textureMap);
  const sideTextureValue = resolveTextureValue(sideTextureIdentifier, textureMap);
  const topBlendMode = resolveBlendMode(topTextureIdentifier, imageBlendModeMap);
  const sideBlendMode = resolveBlendMode(sideTextureIdentifier, imageBlendModeMap);

  const mainBuilder = ResoniteObjectBuilder.create({
    id: slotId,
    name: udonObj.name,
  })
    .setRotation({ x: 0, y: udonObj.rotate, z: 0 })
    .setPosition({
      x: basePosition.x + udonObj.width / 2,
      y: basePosition.y + udonObj.height / 2,
      z: basePosition.z - udonObj.depth / 2,
    })
    .setSourceType(udonObj.type);

  const topId = `${mainBuilder.getId()}-top`;
  const wallsId = `${mainBuilder.getId()}-walls`;
  const frontId = `${wallsId}-front`;
  const backId = `${wallsId}-back`;
  const leftId = `${wallsId}-left`;
  const rightId = `${wallsId}-right`;
  const hideWalls = udonObj.mode === 1;

  const topSurface = ResoniteObjectBuilder.create({
    id: topId,
    name: `${udonObj.name}-top`,
  })
    .setPosition({ x: 0, y: udonObj.height / 2, z: 0 })
    .setRotation({ x: 90, y: 0, z: 0 })
    .addQuadMesh(topTextureValue, false, { x: udonObj.width, y: udonObj.depth }, topBlendMode)
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
        sideTextureValue,
        sideBlendMode
      )
    )
    .addChild(
      buildWallSlot(
        backId,
        `${udonObj.name}-back`,
        { x: 0, y: 0, z: udonObj.depth / 2 },
        { x: 0, y: 180, z: 0 },
        { x: udonObj.width, y: udonObj.height },
        sideTextureValue,
        sideBlendMode
      )
    )
    .addChild(
      buildWallSlot(
        leftId,
        `${udonObj.name}-left`,
        { x: -udonObj.width / 2, y: 0, z: 0 },
        { x: 0, y: 90, z: 0 },
        { x: udonObj.depth, y: udonObj.height },
        sideTextureValue,
        sideBlendMode
      )
    )
    .addChild(
      buildWallSlot(
        rightId,
        `${udonObj.name}-right`,
        { x: udonObj.width / 2, y: 0, z: 0 },
        { x: 0, y: -90, z: 0 },
        { x: udonObj.depth, y: udonObj.height },
        sideTextureValue,
        sideBlendMode
      )
    )
    .build();

  // Axis mapping: width -> X, height -> Y, depth -> Z
  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  mainBuilder.addBoxCollider(
    { x: udonObj.width, y: udonObj.height, z: udonObj.depth },
    { characterCollider: udonObj.isLocked }
  );

  if (!udonObj.isLocked) {
    mainBuilder.addGrabbable();
  }

  return mainBuilder.addChild(topSurface).addChild(wallsContainer).build();
}
