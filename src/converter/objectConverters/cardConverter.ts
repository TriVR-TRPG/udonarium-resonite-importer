import { Card } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';
import {
  buildBoxColliderComponent,
  buildQuadMeshComponents,
  resolveTextureValue,
} from './componentBuilders';

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

  // Lay cards flat on the table (horizontal quad).
  resoniteObj.rotation = { x: 90, y: 0, z: 0 };
  resoniteObj.components = buildQuadMeshComponents(resoniteObj.id, textureValue, true, {
    x: 0.6,
    y: 0.9,
  });
  resoniteObj.components.push(
    // Cards are rotated (x=90), so thickness must stay on local Z.
    buildBoxColliderComponent(resoniteObj.id, { x: 0.6, y: 0.9, z: 0.01 })
  );
}
