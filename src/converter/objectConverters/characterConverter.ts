import { GameCharacter } from '../../domain/UdonariumObject';
import { ResoniteObject, Vector3 } from '../../domain/ResoniteObject';
import {
  buildBoxColliderComponent,
  buildQuadMeshComponents,
  BlendModeValue,
  resolveTextureValue,
} from './componentBuilders';
import { lookupImageHasAlpha } from '../imageAspectRatioMap';

function resolveBlendMode(
  identifier: string | undefined,
  imageAlphaMap?: Map<string, boolean>
): BlendModeValue {
  if (!imageAlphaMap) {
    return 'Cutout';
  }
  return lookupImageHasAlpha(imageAlphaMap, identifier) ? 'Alpha' : 'Opaque';
}

export function applyCharacterConversion(
  udonObj: GameCharacter,
  resoniteObj: ResoniteObject,
  convertSize: (size: number) => Vector3,
  textureMap?: Map<string, string>,
  imageAlphaMap?: Map<string, boolean>
): void {
  const size = convertSize(udonObj.size);
  const textureIdentifier = udonObj.images[0]?.identifier;
  const textureValue = resolveTextureValue(textureIdentifier, textureMap);
  const blendMode = resolveBlendMode(textureIdentifier, imageAlphaMap);
  resoniteObj.components = buildQuadMeshComponents(
    resoniteObj.id,
    textureValue,
    true,
    {
      x: size.x,
      y: size.y,
    },
    blendMode
  );
  resoniteObj.components.push(
    buildBoxColliderComponent(resoniteObj.id, {
      x: size.x,
      y: size.y,
      z: 0.05,
    })
  );
  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  resoniteObj.position.x += size.x / 2;
  resoniteObj.position.z -= size.x / 2;
  resoniteObj.position.y += size.y / 2;
}
