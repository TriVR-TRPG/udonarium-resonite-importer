import { GameTable } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';
import { SIZE_MULTIPLIER } from '../../config/MappingConfig';
import { buildQuadMeshComponents, resolveTextureValue } from './componentBuilders';

export function applyTableConversion(
  udonObj: GameTable,
  resoniteObj: ResoniteObject,
  textureMap?: Map<string, string>
): void {
  // Lay table surface flat (horizontal quad).
  resoniteObj.rotation = { x: 90, y: 0, z: 0 };
  resoniteObj.scale = {
    x: udonObj.width * SIZE_MULTIPLIER,
    y: udonObj.height * SIZE_MULTIPLIER,
    z: 0.1,
  };
  resoniteObj.position.y = -0.1;
  const textureValue = resolveTextureValue(udonObj.images[0]?.identifier, textureMap);
  resoniteObj.components = buildQuadMeshComponents(resoniteObj.id, textureValue, false);
}
