import { CardStack, UdonariumObject } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';
import { buildBoxColliderComponent } from './componentBuilders';

const CARD_STACK_Y_OFFSET = 0.001;

export function applyCardStackConversion(
  udonObj: CardStack,
  resoniteObj: ResoniteObject,
  convertObject: (obj: UdonariumObject) => ResoniteObject
): void {
  const cardWidth = udonObj.cards[0]?.size ?? 1;
  const cardHeight = cardWidth * 1.5;
  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  resoniteObj.position.x += cardWidth / 2;
  resoniteObj.position.z -= cardHeight / 2;
  resoniteObj.position.y += CARD_STACK_Y_OFFSET;
  resoniteObj.components = [
    buildBoxColliderComponent(resoniteObj.id, { x: cardWidth, y: 0.05, z: cardHeight }),
  ];
  resoniteObj.children = udonObj.cards.map((card, i) => {
    const child = convertObject(card);
    // Stack cards locally under the parent slot.
    child.position = { x: 0, y: i * 0.0005, z: 0 };
    return child;
  });
}
