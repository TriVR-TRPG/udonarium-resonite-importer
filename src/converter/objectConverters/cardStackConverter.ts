import { CardStack, UdonariumObject } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';
import { buildBoxColliderComponent, buildGrabbableComponent } from './componentBuilders';
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

export function convertCardStack(
  udonObj: CardStack,
  baseObj: ResoniteObject,
  convertObject: (obj: UdonariumObject) => ResoniteObject,
  imageAspectRatioMap?: Map<string, number>
): ResoniteObject {
  const cardWidth = udonObj.cards[0]?.size ?? 1;
  const cardHeight = cardWidth * resolveCardAspectRatio(udonObj, imageAspectRatioMap);
  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  return {
    ...baseObj,
    position: {
      x: baseObj.position.x + cardWidth / 2,
      y: baseObj.position.y + CARD_STACK_Y_OFFSET,
      z: baseObj.position.z - cardHeight / 2,
    },
    rotation: { x: 0, y: udonObj.rotate ?? 0, z: 0 },
    components: [
      buildBoxColliderComponent(baseObj.id, { x: cardWidth, y: 0.05, z: cardHeight }),
      buildGrabbableComponent(baseObj.id),
    ],
    children: [...udonObj.cards].reverse().map((card, i) => ({
      ...convertObject(card),
      // Stack cards locally under the parent slot.
      position: { x: 0, y: i * 0.0005, z: 0 },
    })),
  };
}
