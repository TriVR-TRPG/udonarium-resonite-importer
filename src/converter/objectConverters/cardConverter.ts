import { Card } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';
import { buildQuadMeshComponents } from './componentBuilders';

export function applyCardConversion(udonObj: Card, resoniteObj: ResoniteObject): void {
  const textureIdentifier = udonObj.isFaceUp
    ? (udonObj.frontImage?.identifier ??
      udonObj.backImage?.identifier ??
      udonObj.images[0]?.identifier)
    : (udonObj.backImage?.identifier ??
      udonObj.frontImage?.identifier ??
      udonObj.images[0]?.identifier);

  resoniteObj.scale = { x: 0.06, y: 0.001, z: 0.09 };
  resoniteObj.components = buildQuadMeshComponents(resoniteObj.id, textureIdentifier, true);
}
