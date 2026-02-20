import { GameTable, UdonariumObject } from '../../domain/UdonariumObject';
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
    return 'Cutout';
  }
  return lookupImageBlendMode(imageBlendModeMap, identifier) ?? 'Cutout';
}

export function convertTable(
  udonObj: GameTable,
  basePosition: Vector3,
  textureMap?: Map<string, string>,
  convertObject?: (obj: UdonariumObject) => ResoniteObject,
  imageBlendModeMap?: Map<string, ImageBlendMode>,
  slotId?: string,
  options?: { enableCharacterColliderOnLockedTerrain?: boolean }
): ResoniteObject {
  const parentBuilder = ResoniteObjectBuilder.create({
    id: slotId,
    name: udonObj.name,
  })
    .setPosition(basePosition)
    .setRotation({ x: 0, y: 0, z: 0 })
    .setSourceType(udonObj.type);

  const surfaceId = `${parentBuilder.getId()}-surface`;
  const textureIdentifier = udonObj.images[0]?.identifier;
  const textureValue = resolveTextureValue(textureIdentifier, textureMap);
  const blendMode = resolveBlendMode(textureIdentifier, imageBlendModeMap);
  const tableVisual = ResoniteObjectBuilder.create({
    id: surfaceId,
    name: `${udonObj.name}-surface`,
  })
    .setPosition({ x: udonObj.width / 2, y: 0, z: -udonObj.height / 2 })
    .setRotation({ x: 90, y: 0, z: 0 })
    .addQuadMesh(textureValue, true, { x: udonObj.width, y: udonObj.height }, blendMode)
    .addBoxCollider(
      { x: udonObj.width, y: udonObj.height, z: 0 },
      { characterCollider: options?.enableCharacterColliderOnLockedTerrain ?? false }
    )
    .build();

  const convertedChildren =
    convertObject && udonObj.children.length > 0
      ? udonObj.children.map((child) => convertObject(child))
      : [];

  // Keep table container unrotated so child object positions stay stable.
  return parentBuilder.addChildren([tableVisual, ...convertedChildren]).build();
}
