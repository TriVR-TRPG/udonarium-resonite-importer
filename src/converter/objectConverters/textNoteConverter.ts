import { TextNote } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';
import { buildBoxColliderComponent } from './componentBuilders';

export function applyTextNoteConversion(udonObj: TextNote, resoniteObj: ResoniteObject): void {
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
