import { Card } from '../../domain/UdonariumObject';
import { ImageBlendMode } from '../../config/MappingConfig';
import { ResoniteObject } from '../../domain/ResoniteObject';
import {
  buildBoxColliderComponent,
  buildGrabbableComponent,
  buildQuadMeshComponents,
  BlendModeValue,
  resolveTextureValue,
} from './componentBuilders';
import { lookupImageAspectRatio, lookupImageBlendMode } from '../imageAspectRatioMap';

const CARD_Y_OFFSET = 0.001;
const CARD_FACE_SEPARATION = 0.0001;
const DEFAULT_CARD_ASPECT_RATIO = 1;

function resolveBlendMode(
  identifier: string | undefined,
  imageBlendModeMap?: Map<string, ImageBlendMode>
): BlendModeValue {
  if (!imageBlendModeMap) {
    return 'Cutout';
  }
  return lookupImageBlendMode(imageBlendModeMap, identifier) ?? 'Cutout';
}

function resolveFrontTextureIdentifier(card: Card): string | undefined {
  return card.frontImage?.identifier ?? card.backImage?.identifier ?? card.images[0]?.identifier;
}

function resolveBackTextureIdentifier(card: Card): string | undefined {
  return (
    card.backImage?.identifier ??
    card.frontImage?.identifier ??
    card.images[1]?.identifier ??
    card.images[0]?.identifier
  );
}

function resolveFrontAspectIdentifier(card: Card): string | undefined {
  return (
    card.frontImage?.identifier ??
    card.images[0]?.identifier ??
    card.backImage?.identifier ??
    card.images[1]?.identifier
  );
}

function resolveBackAspectIdentifier(card: Card): string | undefined {
  return (
    card.backImage?.identifier ??
    card.images[1]?.identifier ??
    card.frontImage?.identifier ??
    card.images[0]?.identifier
  );
}

function resolveAspectRatio(
  primaryIdentifier: string | undefined,
  secondaryIdentifier: string | undefined,
  imageAspectRatioMap?: Map<string, number>
): number {
  if (!imageAspectRatioMap) {
    return DEFAULT_CARD_ASPECT_RATIO;
  }

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

export function convertCard(
  udonObj: Card,
  baseObj: ResoniteObject,
  textureMap?: Map<string, string>,
  imageAspectRatioMap?: Map<string, number>,
  imageBlendModeMap?: Map<string, ImageBlendMode>
): ResoniteObject {
  const cardWidth = udonObj.size ?? 1;
  const frontAspectRatio = resolveAspectRatio(
    resolveFrontAspectIdentifier(udonObj),
    resolveBackAspectIdentifier(udonObj),
    imageAspectRatioMap
  );
  const backAspectRatio = resolveAspectRatio(
    resolveBackAspectIdentifier(udonObj),
    resolveFrontAspectIdentifier(udonObj),
    imageAspectRatioMap
  );
  const frontHeight = cardWidth * frontAspectRatio;
  const backHeight = cardWidth * backAspectRatio;
  const parentHeight = Math.max(frontHeight, backHeight);
  const frontZOffset = (parentHeight - frontHeight) / 2;
  const backZOffset = (parentHeight - backHeight) / 2;
  const frontTextureIdentifier = resolveFrontTextureIdentifier(udonObj);
  const backTextureIdentifier = resolveBackTextureIdentifier(udonObj);
  const frontTextureValue = resolveTextureValue(frontTextureIdentifier, textureMap);
  const backTextureValue = resolveTextureValue(backTextureIdentifier, textureMap);
  const frontBlendMode = resolveBlendMode(frontTextureIdentifier, imageBlendModeMap);
  const backBlendMode = resolveBlendMode(backTextureIdentifier, imageBlendModeMap);

  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  // Slight Y offset so cards don't z-fight with the table surface.
  // Keep parent slot rotation on table plane; lay-flat rotation is applied on child faces.
  return {
    ...baseObj,
    position: {
      x: baseObj.position.x + cardWidth / 2,
      y: baseObj.position.y + CARD_Y_OFFSET,
      z: baseObj.position.z - parentHeight / 2,
    },
    rotation: {
      x: 0,
      y: udonObj.rotate ?? 0,
      z: udonObj.isFaceUp ? 0 : 180,
    },
    components: [
      // Parent slot rotates only on Y, so make collider thin on local Y.
      buildBoxColliderComponent(baseObj.id, { x: cardWidth, y: 0.01, z: parentHeight }),
      buildGrabbableComponent(baseObj.id),
    ],
    children: [
      {
        id: `${baseObj.id}-front`,
        name: `${baseObj.name}-front`,
        // Align top edges when front/back heights differ.
        position: { x: 0, y: CARD_FACE_SEPARATION, z: frontZOffset },
        rotation: { x: 90, y: 0, z: 0 },
        textures: [],
        components: buildQuadMeshComponents(
          `${baseObj.id}-front`,
          frontTextureValue,
          false,
          {
            x: cardWidth,
            y: frontHeight,
          },
          frontBlendMode
        ),
        children: [],
      },
      {
        id: `${baseObj.id}-back`,
        name: `${baseObj.name}-back`,
        // Align top edges when front/back heights differ.
        position: { x: 0, y: -CARD_FACE_SEPARATION, z: backZOffset },
        rotation: { x: -90, y: 180, z: 0 },
        textures: [],
        components: buildQuadMeshComponents(
          `${baseObj.id}-back`,
          backTextureValue,
          false,
          {
            x: cardWidth,
            y: backHeight,
          },
          backBlendMode
        ),
        children: [],
      },
    ],
  };
}
