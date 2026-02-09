import { Card } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';
import { buildQuadMeshComponents, resolveTextureValue } from './componentBuilders';

export function applyCardConversion(
  udonObj: Card,
  resoniteObj: ResoniteObject,
  textureMap?: Map<string, string>
): void {
  const textureIdentifier = udonObj.isFaceUp
    ? (udonObj.frontImage?.identifier ??
      udonObj.backImage?.identifier ??
      udonObj.images[0]?.identifier)
    : (udonObj.backImage?.identifier ??
      udonObj.frontImage?.identifier ??
      udonObj.images[0]?.identifier);
  const textureValue = resolveTextureValue(textureIdentifier, textureMap);

  resoniteObj.scale = { x: 0.6, y: 0.01, z: 0.9 };
  resoniteObj.components = buildQuadMeshComponents(resoniteObj.id, textureValue, true);
}
