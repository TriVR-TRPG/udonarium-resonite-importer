import { GameTable } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';
import { SCALE_FACTOR } from '../../config/MappingConfig';
import { buildQuadMeshComponents, resolveTextureValue } from './componentBuilders';

export function applyTableConversion(
  udonObj: GameTable,
  resoniteObj: ResoniteObject,
  textureMap?: Map<string, string>
): void {
  resoniteObj.scale = {
    x: udonObj.width * SCALE_FACTOR,
    y: 0.01,
    z: udonObj.height * SCALE_FACTOR,
  };
  resoniteObj.position.y = -0.01;
  const textureValue = resolveTextureValue(udonObj.images[0]?.identifier, textureMap);
  resoniteObj.components = buildQuadMeshComponents(resoniteObj.id, textureValue, false);
}
