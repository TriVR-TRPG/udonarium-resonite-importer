import { DiceSymbol } from '../../domain/UdonariumObject';
import { ImageBlendMode } from '../../config/MappingConfig';
import { ResoniteObject, Vector3 } from '../../domain/ResoniteObject';
import {
  BlendModeValue,
  buildBoxColliderComponent,
  buildGrabbableComponent,
  buildQuadMeshComponents,
  resolveTextureValue,
} from './componentBuilders';
import { lookupImageAspectRatio, lookupImageBlendMode } from '../imageAspectRatioMap';

const DEFAULT_DICE_ASPECT_RATIO = 1;

function resolveBlendMode(
  identifier: string | undefined,
  imageBlendModeMap?: Map<string, ImageBlendMode>
): BlendModeValue {
  if (!imageBlendModeMap) {
    return 'Opaque';
  }
  return lookupImageBlendMode(imageBlendModeMap, identifier) ?? 'Opaque';
}

export function convertDiceSymbol(
  udonObj: DiceSymbol,
  baseObj: ResoniteObject,
  convertSize: (size: number) => Vector3,
  textureMap?: Map<string, string>,
  imageAspectRatioMap?: Map<string, number>,
  imageBlendModeMap?: Map<string, ImageBlendMode>
): ResoniteObject {
  const size = convertSize(udonObj.size);
  const faceWidth = size.x;
  const faceHeights = udonObj.faceImages.map((faceImage) => {
    if (!imageAspectRatioMap) {
      return faceWidth * DEFAULT_DICE_ASPECT_RATIO;
    }
    const ratio =
      lookupImageAspectRatio(imageAspectRatioMap, faceImage.identifier) ??
      DEFAULT_DICE_ASPECT_RATIO;
    return faceWidth * ratio;
  });
  const maxFaceHeight = faceHeights.reduce(
    (max, current) => (current > max ? current : max),
    faceWidth * DEFAULT_DICE_ASPECT_RATIO
  );
  const activeFaceName = udonObj.face ?? udonObj.faceImages[0]?.name;

  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  return {
    ...baseObj,
    rotation: { x: 0, y: udonObj.rotate ?? 0, z: 0 },
    // Keep only collider on parent; visual renderers live on face child slots.
    components: [
      buildBoxColliderComponent(baseObj.id, {
        x: faceWidth,
        y: maxFaceHeight,
        z: 0.05,
      }),
      buildGrabbableComponent(baseObj.id),
    ],
    children: udonObj.faceImages.map((faceImage, index) => {
      const childId = `${baseObj.id}-face-${index}`;
      const childHeight = faceHeights[index] ?? faceWidth * DEFAULT_DICE_ASPECT_RATIO;
      const childTextureValue = resolveTextureValue(faceImage.identifier, textureMap);
      const childBlendMode = resolveBlendMode(faceImage.identifier, imageBlendModeMap);
      return {
        id: childId,
        name: `${baseObj.name}-face-${faceImage.name}`,
        // Align smaller faces to the bottom edge of the largest face.
        position: { x: 0, y: -(maxFaceHeight - childHeight) / 2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        isActive: faceImage.name === activeFaceName,
        textures: [faceImage.identifier],
        components: buildQuadMeshComponents(
          childId,
          childTextureValue,
          true,
          {
            x: faceWidth,
            y: childHeight,
          },
          childBlendMode
        ),
        children: [],
      };
    }),
    position: {
      x: baseObj.position.x + faceWidth / 2,
      y: baseObj.position.y + maxFaceHeight / 2,
      z: baseObj.position.z - faceWidth / 2,
    },
  };
}
