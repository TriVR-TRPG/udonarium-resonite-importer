import { GameCharacter } from '../UdonariumObject';
import { ResoniteObject, Vector3 } from '../ResoniteObject';
import { buildQuadMeshComponents, resolveTextureValue } from './componentBuilders';

export function applyCharacterConversion(
  udonObj: GameCharacter,
  resoniteObj: ResoniteObject,
  convertSize: (size: number) => Vector3,
  textureMap?: Map<string, string>
): void {
  resoniteObj.scale = convertSize(udonObj.size);
  const textureValue = resolveTextureValue(udonObj.images[0]?.identifier, textureMap);
  resoniteObj.components = buildQuadMeshComponents(resoniteObj.id, textureValue, true);
}
