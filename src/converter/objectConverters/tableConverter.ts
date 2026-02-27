import { GameTable, UdonariumObject } from '../../domain/UdonariumObject';
import { ResoniteObject, Vector3 } from '../../domain/ResoniteObject';
import { ResoniteObjectBuilder } from '../ResoniteObjectBuilder';
import { ImageAssetContext } from '../imageAssetContext';

export function convertTable(
  udonObj: GameTable,
  basePosition: Vector3,
  imageAssetContext: ImageAssetContext,
  convertObject?: (obj: UdonariumObject) => ResoniteObject,
  options?: { enableCharacterColliderOnLockedTerrain?: boolean },
  slotId?: string
): ResoniteObject {
  const parentBuilder = ResoniteObjectBuilder.create({
    ...(slotId != null ? { id: slotId } : {}),
    name: udonObj.name,
  })
    .setPosition(basePosition)
    .setRotation({ x: 0, y: 0, z: 0 })
    .setSourceType(udonObj.type);

  const surfaceId = `${parentBuilder.getId()}-surface`;
  const textureIdentifier = udonObj.images[0]?.identifier;
  const tableVisual = ResoniteObjectBuilder.create({
    id: surfaceId,
    name: `${udonObj.name}-surface`,
  })
    .setPosition({ x: udonObj.width / 2, y: 0, z: -udonObj.height / 2 })
    .setRotation({ x: 90, y: 0, z: 0 })
    .addQuadMesh({
      ...(textureIdentifier != null ? { textureIdentifier } : {}),
      dualSided: true,
      size: { x: udonObj.width, y: udonObj.height },
      imageAssetContext,
    })
    .addBoxCollider(
      { x: udonObj.width, y: udonObj.height, z: 0 },
      { characterCollider: options?.enableCharacterColliderOnLockedTerrain ?? true }
    )
    .build();

  const convertedChildren =
    convertObject && udonObj.children.length > 0
      ? udonObj.children.map((child) => convertObject(child))
      : [];

  return parentBuilder.addChildren([tableVisual, ...convertedChildren]).build();
}
