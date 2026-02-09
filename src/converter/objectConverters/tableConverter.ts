import { GameTable } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';
import { SIZE_MULTIPLIER } from '../../config/MappingConfig';
import { buildQuadMeshComponents, resolveTextureValue } from './componentBuilders';

export function applyTableConversion(
  udonObj: GameTable,
  resoniteObj: ResoniteObject,
  textureMap?: Map<string, string>
): void {
  resoniteObj.scale = {
    x: udonObj.width * SIZE_MULTIPLIER,
    y: 0.1,
    z: udonObj.height * SIZE_MULTIPLIER,
  };
  resoniteObj.position.y = -0.1;
  const textureValue = resolveTextureValue(udonObj.images[0]?.identifier, textureMap);
  resoniteObj.components = buildQuadMeshComponents(resoniteObj.id, textureValue, false);
}
