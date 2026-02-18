import { TextNote } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';
import { ResoniteObjectBuilder } from '../ResoniteObjectBuilder';

export function convertTextNote(udonObj: TextNote, baseObj: ResoniteObject): ResoniteObject {
  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  return new ResoniteObjectBuilder({
    ...baseObj,
    position: {
      x: baseObj.position.x + 1 / 2,
      y: baseObj.position.y,
      z: baseObj.position.z - 1 / 2,
    },
  })
    .addTextComponent(udonObj.text, Math.max(8, udonObj.fontSize))
    .addBoxCollider({ x: 1, y: 0.02, z: 1 })
    .build();
}
