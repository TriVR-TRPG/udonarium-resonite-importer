import { TextNote } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';
import { buildBoxColliderComponent } from './componentBuilders';

export function convertTextNote(udonObj: TextNote, baseObj: ResoniteObject): ResoniteObject {
  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  return {
    ...baseObj,
    position: {
      x: baseObj.position.x + 1 / 2,
      y: baseObj.position.y,
      z: baseObj.position.z - 1 / 2,
    },
    components: [
      {
        id: `${baseObj.id}-text`,
        type: '[FrooxEngine]FrooxEngine.UIX.Text',
        fields: {
          Content: { $type: 'string', value: udonObj.text },
          Size: { $type: 'float', value: Math.max(8, udonObj.fontSize) },
        },
      },
      buildBoxColliderComponent(baseObj.id, { x: 1, y: 0.02, z: 1 }),
    ],
  };
}
