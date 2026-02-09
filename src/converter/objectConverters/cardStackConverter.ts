import { CardStack, UdonariumObject } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';

export function applyCardStackConversion(
  udonObj: CardStack,
  resoniteObj: ResoniteObject,
  convertObject: (obj: UdonariumObject) => ResoniteObject
): void {
  resoniteObj.scale = { x: 0.6, y: 0.01, z: 0.9 };
  resoniteObj.components = [];
  resoniteObj.children = udonObj.cards.map((card, i) => {
    const child = convertObject(card);
    // Stack cards locally under the parent slot.
    child.position = { x: 0, y: i * 0.0005, z: 0 };
    return child;
  });
}
