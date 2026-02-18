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
  return new ResoniteObjectBuilder({ id, name, position, rotation })
    .addQuadMesh(textureValue, false, size, blendMode)
    .build();
}

export function convertTerrain(
  udonObj: Terrain,
  baseObj: ResoniteObject,
  textureMap?: Map<string, string>,
  imageBlendModeMap?: Map<string, ImageBlendMode>
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

  const topId = `${baseObj.id}-top`;
  const wallsId = `${baseObj.id}-walls`;
  const frontId = `${wallsId}-front`;
  const backId = `${wallsId}-back`;
  const leftId = `${wallsId}-left`;
  const rightId = `${wallsId}-right`;
  const hideWalls = udonObj.mode === 1;

  const topSurface = new ResoniteObjectBuilder({
    id: topId,
    name: `${baseObj.name}-top`,
    position: { x: 0, y: udonObj.height / 2, z: 0 },
    rotation: { x: 90, y: 0, z: 0 },
  })
    .addQuadMesh(topTextureValue, false, { x: udonObj.width, y: udonObj.depth }, topBlendMode)
    .build();

  const wallsContainer = new ResoniteObjectBuilder({
    id: wallsId,
    name: `${baseObj.name}-walls`,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    isActive: !hideWalls,
  })
    .addChild(
      buildWallSlot(
        frontId,
        `${baseObj.name}-front`,
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
        `${baseObj.name}-back`,
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
        `${baseObj.name}-left`,
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
        `${baseObj.name}-right`,
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
  const mainBuilder = new ResoniteObjectBuilder({
    ...baseObj,
    rotation: { x: 0, y: udonObj.rotate, z: 0 },
    position: {
      x: baseObj.position.x + udonObj.width / 2,
      y: baseObj.position.y + udonObj.height / 2,
      z: baseObj.position.z - udonObj.depth / 2,
    },
  }).addBoxCollider(
    { x: udonObj.width, y: udonObj.height, z: udonObj.depth },
    { characterCollider: udonObj.isLocked }
  );

  if (!udonObj.isLocked) {
    mainBuilder.addGrabbable();
  }

  return mainBuilder.addChild(topSurface).addChild(wallsContainer).build();
}
