import { CardStack, UdonariumObject } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';
import { buildBoxColliderComponent } from './componentBuilders';

export function applyCardStackConversion(
  udonObj: CardStack,
  resoniteObj: ResoniteObject,
  convertObject: (obj: UdonariumObject) => ResoniteObject
): void {
  resoniteObj.components = [buildBoxColliderComponent(resoniteObj.id, { x: 0.6, y: 0.05, z: 0.9 })];
  resoniteObj.children = udonObj.cards.map((card, i) => {
    const child = convertObject(card);
    // Stack cards locally under the parent slot.
    child.position = { x: 0, y: i * 0.0005, z: 0 };
    return child;
  });
}
