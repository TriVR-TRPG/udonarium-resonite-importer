import { Card } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';
import {
  buildBoxColliderComponent,
  buildQuadMeshComponents,
  resolveTextureValue,
} from './componentBuilders';
import { lookupImageAspectRatio } from '../imageAspectRatioMap';

const CARD_Y_OFFSET = 0.001;
const CARD_FACE_SEPARATION = 0.0001;
const DEFAULT_CARD_ASPECT_RATIO = 1;

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

export function applyCardConversion(
  udonObj: Card,
  resoniteObj: ResoniteObject,
  textureMap?: Map<string, string>,
  imageAspectRatioMap?: Map<string, number>
): void {
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
  const frontTextureValue = resolveTextureValue(resolveFrontTextureIdentifier(udonObj), textureMap);
  const backTextureValue = resolveTextureValue(resolveBackTextureIdentifier(udonObj), textureMap);

  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  resoniteObj.position.x += cardWidth / 2;
  resoniteObj.position.z -= parentHeight / 2;
  // Slight Y offset so cards don't z-fight with the table surface.
  resoniteObj.position.y += CARD_Y_OFFSET;
  // Keep parent slot rotation on table plane; lay-flat rotation is applied on child faces.
  resoniteObj.rotation = {
    x: 0,
    y: udonObj.rotate ?? 0,
    z: udonObj.isFaceUp ? 0 : 180,
  };
  resoniteObj.components = [
    // Parent slot rotates only on Y, so make collider thin on local Y.
    buildBoxColliderComponent(resoniteObj.id, { x: cardWidth, y: 0.01, z: parentHeight }),
    {
      id: `${resoniteObj.id}-grabbable`,
      type: '[FrooxEngine]FrooxEngine.Grabbable',
      fields: {},
    },
  ];
  resoniteObj.children = [
    {
      id: `${resoniteObj.id}-front`,
      name: `${resoniteObj.name}-front`,
      // Align top edges when front/back heights differ.
      position: { x: 0, y: CARD_FACE_SEPARATION, z: frontZOffset },
      rotation: { x: 90, y: 0, z: 0 },
      textures: [],
      components: buildQuadMeshComponents(`${resoniteObj.id}-front`, frontTextureValue, false, {
        x: cardWidth,
        y: frontHeight,
      }),
      children: [],
    },
    {
      id: `${resoniteObj.id}-back`,
      name: `${resoniteObj.name}-back`,
      // Align top edges when front/back heights differ.
      position: { x: 0, y: -CARD_FACE_SEPARATION, z: backZOffset },
      rotation: { x: -90, y: 180, z: 0 },
      textures: [],
      components: buildQuadMeshComponents(`${resoniteObj.id}-back`, backTextureValue, false, {
        x: cardWidth,
        y: backHeight,
      }),
      children: [],
    },
  ];
}
