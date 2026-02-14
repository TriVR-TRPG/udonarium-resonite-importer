import { Card } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';
import {
  buildBoxColliderComponent,
  buildQuadMeshComponents,
  resolveTextureValue,
} from './componentBuilders';

const CARD_Y_OFFSET = 0.001;
const CARD_FACE_SEPARATION = 0.0001;

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

export function applyCardConversion(
  udonObj: Card,
  resoniteObj: ResoniteObject,
  textureMap?: Map<string, string>
): void {
  const cardWidth = udonObj.size ?? 1;
  const cardHeight = cardWidth * 1.5;
  const frontTextureValue = resolveTextureValue(resolveFrontTextureIdentifier(udonObj), textureMap);
  const backTextureValue = resolveTextureValue(resolveBackTextureIdentifier(udonObj), textureMap);

  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  resoniteObj.position.x += cardWidth / 2;
  resoniteObj.position.z -= cardHeight / 2;
  // Slight Y offset so cards don't z-fight with the table surface.
  resoniteObj.position.y += CARD_Y_OFFSET;
  // Lay cards flat on the table (horizontal quad).
  resoniteObj.rotation = { x: udonObj.isFaceUp ? 90 : -90, y: 0, z: 0 };
  resoniteObj.components = [
    // Cards are rotated (x=90), so thickness must stay on local Z.
    buildBoxColliderComponent(resoniteObj.id, { x: cardWidth, y: cardHeight, z: 0.01 }),
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
      position: { x: 0, y: 0, z: CARD_FACE_SEPARATION },
      rotation: { x: 0, y: 0, z: 0 },
      textures: [],
      components: buildQuadMeshComponents(`${resoniteObj.id}-front`, frontTextureValue, false, {
        x: cardWidth,
        y: cardHeight,
      }),
      children: [],
    },
    {
      id: `${resoniteObj.id}-back`,
      name: `${resoniteObj.name}-back`,
      position: { x: 0, y: 0, z: -CARD_FACE_SEPARATION },
      rotation: { x: 0, y: 180, z: 0 },
      textures: [],
      components: buildQuadMeshComponents(`${resoniteObj.id}-back`, backTextureValue, false, {
        x: cardWidth,
        y: cardHeight,
      }),
      children: [],
    },
  ];
}
