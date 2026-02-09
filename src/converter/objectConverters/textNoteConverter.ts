import { TextNote } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';

export function applyTextNoteConversion(udonObj: TextNote, resoniteObj: ResoniteObject): void {
  resoniteObj.scale = { x: 1, y: 1, z: 1 };
  resoniteObj.components = [
    {
      id: `${resoniteObj.id}-text`,
      type: '[FrooxEngine]FrooxEngine.UIX.Text',
      fields: {
        Content: { $type: 'string', value: udonObj.text },
        Size: { $type: 'float', value: Math.max(8, udonObj.fontSize) },
      },
    },
  ];
}
