import { TextNote } from '../../domain/UdonariumObject';
import { ResoniteObject, Vector3 } from '../../domain/ResoniteObject';
import { ResoniteObjectBuilder } from '../ResoniteObjectBuilder';

export function convertTextNote(
  udonObj: TextNote,
  basePosition: Vector3,
  slotId?: string
): ResoniteObject {
  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  return ResoniteObjectBuilder.create({
    id: slotId,
    name: udonObj.name,
  })
    .setPosition({
      x: basePosition.x + 1 / 2,
      y: basePosition.y,
      z: basePosition.z - 1 / 2,
    })
    .setRotation({ x: 0, y: 0, z: 0 })
    .setSourceType(udonObj.type)
    .addTextComponent(udonObj.text, Math.max(8, udonObj.fontSize))
    .addBoxCollider({ x: 1, y: 0.02, z: 1 })
    .build();
}
