import { CardStack, UdonariumObject } from '../../domain/UdonariumObject';
import { ResoniteObject, Vector3 } from '../../domain/ResoniteObject';
import { ResoniteObjectBuilder } from '../ResoniteObjectBuilder';
import { ImageAssetContext } from '../imageAssetContext';

const CARD_STACK_Y_OFFSET = 0.001;
const DEFAULT_CARD_ASPECT_RATIO = 1;

function resolveCardAspectRatio(stack: CardStack, imageAssetContext: ImageAssetContext): number {
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
  const primaryAspect = imageAssetContext.lookupAspectRatio(primaryIdentifier);
  const secondaryAspect = imageAssetContext.lookupAspectRatio(secondaryIdentifier);

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
  basePosition: Vector3,
  convertObject: (obj: UdonariumObject) => ResoniteObject,
  imageAssetContext: ImageAssetContext,
  slotId?: string
): ResoniteObject {
  const cardWidth = udonObj.cards[0]?.size ?? 1;
  const cardHeight = cardWidth * resolveCardAspectRatio(udonObj, imageAssetContext);
  const stackedCards = [...udonObj.cards].reverse().map((card, i) => ({
    ...convertObject(card),
    position: { x: 0, y: i * 0.0005, z: 0 },
  }));

  return ResoniteObjectBuilder.create({
    ...(slotId != null ? { id: slotId } : {}),
    name: udonObj.name,
  })
    .setPosition({
      x: basePosition.x + cardWidth / 2,
      y: basePosition.y + CARD_STACK_Y_OFFSET,
      z: basePosition.z - cardHeight / 2,
    })
    .setRotation({ x: 0, y: udonObj.rotate, z: 0 })
    .setSourceType(udonObj.type)
    .addBoxCollider({ x: cardWidth, y: 0.05, z: cardHeight })
    .addGrabbable()
    .addChildren(stackedCards)
    .build();
}
