import { Terrain } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';
import {
  buildBoxColliderComponent,
  buildBoxMeshComponents,
  resolveTextureValue,
} from './componentBuilders';

export function applyTerrainConversion(
  udonObj: Terrain,
  resoniteObj: ResoniteObject,
  textureMap?: Map<string, string>
): void {
  const textureIdentifier = udonObj.floorImage?.identifier ?? udonObj.images[0]?.identifier;
  const textureValue = resolveTextureValue(textureIdentifier, textureMap);
  // Udonarium: width=X, height=Y(horizontal), depth=Z(vertical)
  // Resonite (Y-up): X=width, Y=depth(vertical), Z=height(horizontal)
  resoniteObj.components = buildBoxMeshComponents(resoniteObj.id, textureValue, {
    x: udonObj.width,
    y: udonObj.depth,
    z: udonObj.height,
  });
  resoniteObj.components.push(
    buildBoxColliderComponent(resoniteObj.id, {
      x: udonObj.width,
      y: udonObj.depth,
      z: udonObj.height,
    })
  );
  // Udonarium positions at object bottom; Resonite positions at center
  resoniteObj.position.y += udonObj.depth / 2;
}
