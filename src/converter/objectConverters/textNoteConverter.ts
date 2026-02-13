import { TextNote } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';
import { buildBoxColliderComponent } from './componentBuilders';

export function applyTextNoteConversion(udonObj: TextNote, resoniteObj: ResoniteObject): void {
  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  resoniteObj.position.x += 1 / 2;
  resoniteObj.position.z -= 1 / 2;
  resoniteObj.components = [
    {
      id: `${resoniteObj.id}-text`,
      type: '[FrooxEngine]FrooxEngine.UIX.Text',
      fields: {
        Content: { $type: 'string', value: udonObj.text },
        Size: { $type: 'float', value: Math.max(8, udonObj.fontSize) },
      },
    },
    buildBoxColliderComponent(resoniteObj.id, { x: 1, y: 0.02, z: 1 }),
  ];
}
