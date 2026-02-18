import { GameCharacter } from '../../domain/UdonariumObject';
import { ImageBlendMode } from '../../config/MappingConfig';
import { ResoniteObject, Vector3 } from '../../domain/ResoniteObject';
import {
  buildBoxColliderComponent,
  buildGrabbableComponent,
  buildQuadMeshComponents,
  BlendModeValue,
  resolveTextureValue,
} from './componentBuilders';
import { lookupImageAspectRatio, lookupImageBlendMode } from '../imageAspectRatioMap';

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

export function applyCharacterConversion(
  udonObj: GameCharacter,
  resoniteObj: ResoniteObject,
  convertSize: (size: number) => Vector3,
  textureMap?: Map<string, string>,
  imageAspectRatioMap?: Map<string, number>,
  imageBlendModeMap?: Map<string, ImageBlendMode>
): void {
  const size = convertSize(udonObj.size);
  const meshWidth = size.x;
  const textureIdentifier = udonObj.images[0]?.identifier;
  const meshAspectRatio = imageAspectRatioMap
    ? (lookupImageAspectRatio(imageAspectRatioMap, textureIdentifier) ??
      DEFAULT_CHARACTER_ASPECT_RATIO)
    : DEFAULT_CHARACTER_ASPECT_RATIO;
  const meshHeight = meshWidth * meshAspectRatio;
  const hasCharacterImage = !!textureIdentifier;
  resoniteObj.components = hasCharacterImage
    ? (() => {
        const textureValue = resolveTextureValue(textureIdentifier, textureMap);
        const blendMode = resolveBlendMode(textureIdentifier, imageBlendModeMap);
        return [
          ...buildQuadMeshComponents(
            resoniteObj.id,
            textureValue,
            true,
            {
              x: meshWidth,
              y: meshHeight,
            },
            blendMode
          ),
          buildBoxColliderComponent(resoniteObj.id, {
            x: meshWidth,
            y: meshHeight,
            z: 0.05,
          }),
          buildGrabbableComponent(resoniteObj.id),
        ];
      })()
    : [
        buildBoxColliderComponent(resoniteObj.id, {
          x: meshWidth,
          y: size.y,
          z: 0.05,
        }),
        buildGrabbableComponent(resoniteObj.id),
      ];
  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  resoniteObj.position.x += meshWidth / 2;
  resoniteObj.position.z -= meshWidth / 2;
  resoniteObj.position.y += (hasCharacterImage ? meshHeight : size.y) / 2;
  resoniteObj.rotation = {
    x: 0,
    y: udonObj.rotate ?? 0,
    z: udonObj.roll ?? 0,
  };
}
