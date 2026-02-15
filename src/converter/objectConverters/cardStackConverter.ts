import { CardStack, UdonariumObject } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';
import { buildBoxColliderComponent } from './componentBuilders';
import { lookupImageAspectRatio } from '../imageAspectRatioMap';

const CARD_STACK_Y_OFFSET = 0.001;
const DEFAULT_CARD_ASPECT_RATIO = 1;

function resolveCardAspectRatio(
  stack: CardStack,
  imageAspectRatioMap?: Map<string, number>
): number {
  if (!imageAspectRatioMap) {
    return DEFAULT_CARD_ASPECT_RATIO;
  }

  const sampleCard = stack.cards[0];
  if (!sampleCard) {
    return DEFAULT_CARD_ASPECT_RATIO;
  }

  const frontIdentifier =
    sampleCard.frontImage?.identifier ??
    sampleCard.backImage?.identifier ??
    sampleCard.images[0]?.identifier;
  const backIdentifier =
    sampleCard.backImage?.identifier ??
    sampleCard.frontImage?.identifier ??
    sampleCard.images[1]?.identifier ??
    sampleCard.images[0]?.identifier;

  const primaryIdentifier = sampleCard.isFaceUp ? frontIdentifier : backIdentifier;
  const secondaryIdentifier = sampleCard.isFaceUp ? backIdentifier : frontIdentifier;
  const primaryAspect = lookupImageAspectRatio(imageAspectRatioMap, primaryIdentifier);
  const secondaryAspect = lookupImageAspectRatio(imageAspectRatioMap, secondaryIdentifier);

  if (primaryAspect && Number.isFinite(primaryAspect) && primaryAspect > 0) {
    return primaryAspect;
  }
  if (secondaryAspect && Number.isFinite(secondaryAspect) && secondaryAspect > 0) {
    return secondaryAspect;
  }
  return DEFAULT_CARD_ASPECT_RATIO;
}

export function applyCardStackConversion(
  udonObj: CardStack,
  resoniteObj: ResoniteObject,
  convertObject: (obj: UdonariumObject) => ResoniteObject,
  imageAspectRatioMap?: Map<string, number>
): void {
  const cardWidth = udonObj.cards[0]?.size ?? 1;
  const cardHeight = cardWidth * resolveCardAspectRatio(udonObj, imageAspectRatioMap);
  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  resoniteObj.position.x += cardWidth / 2;
  resoniteObj.position.z -= cardHeight / 2;
  resoniteObj.position.y += CARD_STACK_Y_OFFSET;
  resoniteObj.rotation = { x: 0, y: udonObj.rotate ?? 0, z: 0 };
  resoniteObj.components = [
    buildBoxColliderComponent(resoniteObj.id, { x: cardWidth, y: 0.05, z: cardHeight }),
    {
      id: `${resoniteObj.id}-grabbable`,
      type: '[FrooxEngine]FrooxEngine.Grabbable',
      fields: {},
    },
  ];
  resoniteObj.children = [...udonObj.cards].reverse().map((card, i) => {
    const child = convertObject(card);
    // Stack cards locally under the parent slot.
    child.position = { x: 0, y: i * 0.0005, z: 0 };
    return child;
  });
}
