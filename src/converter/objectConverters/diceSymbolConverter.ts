import { DiceSymbol } from '../../domain/UdonariumObject';
import { ImageBlendMode } from '../../config/MappingConfig';
import { ResoniteObject, Vector3 } from '../../domain/ResoniteObject';
import { lookupImageAspectRatio } from '../imageAspectRatioMap';
import { ResoniteObjectBuilder } from '../ResoniteObjectBuilder';

const DEFAULT_DICE_ASPECT_RATIO = 1;

export function convertDiceSymbol(
  udonObj: DiceSymbol,
  basePosition: Vector3,
  convertSize: (size: number) => Vector3,
  textureMap?: Map<string, string>,
  imageAspectRatioMap?: Map<string, number>,
  imageBlendModeMap?: Map<string, ImageBlendMode>,
  slotId?: string
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
  const activeFaceName = udonObj.face;

  const parentBuilder = ResoniteObjectBuilder.create({
    id: slotId,
    name: udonObj.name,
  })
    .setRotation({ x: 0, y: udonObj.rotate, z: 0 })
    .setPosition({
      x: basePosition.x + faceWidth / 2,
      y: basePosition.y + maxFaceHeight / 2,
      z: basePosition.z - faceWidth / 2,
    })
    .setSourceType(udonObj.type);

  const parentId = parentBuilder.getId();

  const faceSlots = udonObj.faceImages.map((faceImage, index) => {
    const childId = `${parentId}-face-${index}`;
    const childHeight = faceHeights[index] ?? faceWidth * DEFAULT_DICE_ASPECT_RATIO;
    return (
      ResoniteObjectBuilder.create({
        id: childId,
        name: `${udonObj.name}-face-${faceImage.name}`,
      })
        // Align smaller faces to the bottom edge of the largest face.
        .setPosition({ x: 0, y: -(maxFaceHeight - childHeight) / 2, z: 0 })
        .setRotation({ x: 0, y: 0, z: 0 })
        .setActive(faceImage.name === activeFaceName)
        .addQuadMesh({
          textureIdentifier: faceImage.identifier,
          dualSided: true,
          size: { x: faceWidth, y: childHeight },
          imageBlendModeMap,
          textureMap,
        })
        .build()
    );
  });

  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  // Keep only collider on parent; visual renderers live on face child slots.
  return parentBuilder
    .addBoxCollider({ x: faceWidth, y: maxFaceHeight, z: 0.05 })
    .addGrabbable()
    .addChildren(faceSlots)
    .build();
}
