import { Terrain } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';
import { buildBoxMeshComponents, resolveTextureValue } from './componentBuilders';

export function applyTerrainConversion(
  udonObj: Terrain,
  resoniteObj: ResoniteObject,
  textureMap?: Map<string, string>
): void {
  const textureIdentifier = udonObj.floorImage?.identifier ?? udonObj.images[0]?.identifier;
  const textureValue = resolveTextureValue(textureIdentifier, textureMap);
  resoniteObj.components = buildBoxMeshComponents(resoniteObj.id, textureValue, {
    x: udonObj.width,
    y: udonObj.height,
    z: udonObj.depth,
  });
}
