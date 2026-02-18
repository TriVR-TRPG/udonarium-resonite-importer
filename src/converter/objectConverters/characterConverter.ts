import { GameCharacter } from '../../domain/UdonariumObject';
import { ImageBlendMode } from '../../config/MappingConfig';
import { ResoniteObject, Vector3 } from '../../domain/ResoniteObject';
import { BlendModeValue, resolveTextureValue } from '../textureUtils';
import { lookupImageAspectRatio, lookupImageBlendMode } from '../imageAspectRatioMap';
import { ResoniteObjectBuilder } from '../ResoniteObjectBuilder';

const DEFAULT_CHARACTER_ASPECT_RATIO = 1;

function resolveBlendMode(
  identifier: string | undefined,
  imageBlendModeMap?: Map<string, ImageBlendMode>
): BlendModeValue {
  if (!imageBlendModeMap) {
    return 'Opaque';
  }
  return lookupImageBlendMode(imageBlendModeMap, identifier) ?? 'Opaque';
}

export function convertCharacter(
  udonObj: GameCharacter,
  baseObj: ResoniteObject,
  convertSize: (size: number) => Vector3,
  textureMap?: Map<string, string>,
  imageAspectRatioMap?: Map<string, number>,
  imageBlendModeMap?: Map<string, ImageBlendMode>
): ResoniteObject {
  const size = convertSize(udonObj.size);
  const meshWidth = size.x;
  const textureIdentifier = udonObj.images[0]?.identifier;
  const meshAspectRatio = imageAspectRatioMap
    ? (lookupImageAspectRatio(imageAspectRatioMap, textureIdentifier) ??
      DEFAULT_CHARACTER_ASPECT_RATIO)
    : DEFAULT_CHARACTER_ASPECT_RATIO;
  const meshHeight = meshWidth * meshAspectRatio;
  const hasCharacterImage = !!textureIdentifier;

  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  const builder = new ResoniteObjectBuilder({
    ...baseObj,
    position: {
      x: baseObj.position.x + meshWidth / 2,
      y: baseObj.position.y + (hasCharacterImage ? meshHeight : size.y) / 2,
      z: baseObj.position.z - meshWidth / 2,
    },
    rotation: { x: 0, y: udonObj.rotate ?? 0, z: udonObj.roll ?? 0 },
  });

  if (hasCharacterImage) {
    const textureValue = resolveTextureValue(textureIdentifier, textureMap);
    const blendMode = resolveBlendMode(textureIdentifier, imageBlendModeMap);
    builder
      .addQuadMesh(textureValue, true, { x: meshWidth, y: meshHeight }, blendMode)
      .addBoxCollider({ x: meshWidth, y: meshHeight, z: 0.05 });
  } else {
    builder.addBoxCollider({ x: meshWidth, y: size.y, z: 0.05 });
  }

  return builder.addGrabbable().build();
}
