import { Card } from '../../domain/UdonariumObject';
import { ResoniteObject, Vector3 } from '../../domain/ResoniteObject';
import { ResoniteObjectBuilder } from '../ResoniteObjectBuilder';
import { ImageAssetContext } from '../imageAssetContext';

const CARD_Y_OFFSET = 0.001;
const CARD_FACE_SEPARATION = 0.0001;
const DEFAULT_CARD_ASPECT_RATIO = 1;

function resolveFrontTextureIdentifier(card: Card) {
  return card.frontImage?.identifier ?? card.backImage?.identifier ?? card.images[0]?.identifier;
}

function resolveBackTextureIdentifier(card: Card) {
  return (
    card.backImage?.identifier ??
    card.frontImage?.identifier ??
    card.images[1]?.identifier ??
    card.images[0]?.identifier
  );
}

function resolveFrontAspectIdentifier(card: Card) {
  return (
    card.frontImage?.identifier ??
    card.images[0]?.identifier ??
    card.backImage?.identifier ??
    card.images[1]?.identifier
  );
}

function resolveBackAspectIdentifier(card: Card) {
  return (
    card.backImage?.identifier ??
    card.images[1]?.identifier ??
    card.frontImage?.identifier ??
    card.images[0]?.identifier
  );
}

function resolveAspectRatio(
  imageAssetContext: ImageAssetContext,
  primaryIdentifier?: string,
  secondaryIdentifier?: string
): number {
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

export function convertCard(
  udonObj: Card,
  basePosition: Vector3,
  imageAssetContext: ImageAssetContext,
  slotId?: string
): ResoniteObject {
  const cardWidth = udonObj.size;
  const frontAspectRatio = resolveAspectRatio(
    imageAssetContext,
    resolveFrontAspectIdentifier(udonObj),
    resolveBackAspectIdentifier(udonObj)
  );
  const backAspectRatio = resolveAspectRatio(
    imageAssetContext,
    resolveBackAspectIdentifier(udonObj),
    resolveFrontAspectIdentifier(udonObj)
  );
  const frontHeight = cardWidth * frontAspectRatio;
  const backHeight = cardWidth * backAspectRatio;
  const parentHeight = Math.max(frontHeight, backHeight);
  const frontZOffset = (parentHeight - frontHeight) / 2;
  const backZOffset = (parentHeight - backHeight) / 2;
  const frontTextureIdentifier = resolveFrontTextureIdentifier(udonObj);
  const backTextureIdentifier = resolveBackTextureIdentifier(udonObj);

  const parentBuilder = ResoniteObjectBuilder.create({
    ...(slotId != null ? { id: slotId } : {}),
    name: udonObj.name,
  })
    .setPosition({
      x: basePosition.x + cardWidth / 2,
      y: basePosition.y + CARD_Y_OFFSET,
      z: basePosition.z - parentHeight / 2,
    })
    .setRotation({
      x: 0,
      y: udonObj.rotate,
      z: udonObj.isFaceUp ? 0 : 180,
    })
    .setSourceType(udonObj.type);

  const parentId = parentBuilder.getId();

  const frontSlot = ResoniteObjectBuilder.create({
    id: `${parentId}-front`,
    name: `${udonObj.name}-front`,
  })
    .setPosition({ x: 0, y: CARD_FACE_SEPARATION, z: frontZOffset })
    .setRotation({ x: 90, y: 0, z: 0 })
    .addQuadMesh({
      ...(frontTextureIdentifier != null ? { textureIdentifier: frontTextureIdentifier } : {}),
      dualSided: false,
      size: { x: cardWidth, y: frontHeight },
      imageAssetContext,
    })
    .build();

  const backSlot = ResoniteObjectBuilder.create({
    id: `${parentId}-back`,
    name: `${udonObj.name}-back`,
  })
    .setPosition({ x: 0, y: -CARD_FACE_SEPARATION, z: backZOffset })
    .setRotation({ x: -90, y: 180, z: 0 })
    .addQuadMesh({
      ...(backTextureIdentifier != null ? { textureIdentifier: backTextureIdentifier } : {}),
      dualSided: false,
      size: { x: cardWidth, y: backHeight },
      imageAssetContext,
    })
    .build();

  return parentBuilder
    .addBoxCollider({ x: cardWidth, y: 0.01, z: parentHeight })
    .addGrabbable()
    .addChild(frontSlot)
    .addChild(backSlot)
    .build();
}
