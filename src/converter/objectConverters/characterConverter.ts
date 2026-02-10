import { GameCharacter } from '../UdonariumObject';
import { ResoniteObject, Vector3 } from '../ResoniteObject';
import {
  buildBoxColliderComponent,
  buildQuadMeshComponents,
  resolveTextureValue,
} from './componentBuilders';

export function applyCharacterConversion(
  udonObj: GameCharacter,
  resoniteObj: ResoniteObject,
  convertSize: (size: number) => Vector3,
  textureMap?: Map<string, string>
): void {
  const size = convertSize(udonObj.size);
  const textureValue = resolveTextureValue(udonObj.images[0]?.identifier, textureMap);
  resoniteObj.components = buildQuadMeshComponents(resoniteObj.id, textureValue, true, {
    x: size.x,
    y: size.y,
  });
  resoniteObj.components.push(
    buildBoxColliderComponent(resoniteObj.id, {
      x: size.x,
      y: size.y,
      z: 0.05,
    })
  );
  // Udonarium positions at object bottom; Resonite positions at center
  resoniteObj.position.y += size.y / 2;
}
