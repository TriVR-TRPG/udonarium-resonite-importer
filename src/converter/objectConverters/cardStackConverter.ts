import { CardStack, UdonariumObject } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';
import { buildBoxColliderComponent } from './componentBuilders';

export function applyCardStackConversion(
  udonObj: CardStack,
  resoniteObj: ResoniteObject,
  convertObject: (obj: UdonariumObject) => ResoniteObject
): void {
  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  resoniteObj.position.x += 0.6 / 2;
  resoniteObj.position.z -= 0.9 / 2;
  resoniteObj.components = [buildBoxColliderComponent(resoniteObj.id, { x: 0.6, y: 0.05, z: 0.9 })];
  resoniteObj.children = udonObj.cards.map((card, i) => {
    const child = convertObject(card);
    // Stack cards locally under the parent slot.
    child.position = { x: 0, y: i * 0.0005, z: 0 };
    return child;
  });
}
