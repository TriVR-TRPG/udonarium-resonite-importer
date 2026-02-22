import { TableMask } from '../../domain/UdonariumObject';
import { ResoniteObject, Vector3 } from '../../domain/ResoniteObject';
import { ResoniteObjectBuilder } from '../ResoniteObjectBuilder';
import { ImageAssetContext } from '../imageAssetContext';

const TABLE_MASK_Y_OFFSET = 0.002;
const TABLE_MASK_COLLIDER_THICKNESS = 0.01;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function resolveMaskOpacity(mask: TableMask): number {
  return clamp01(mask.opacity / 100);
}

export function convertTableMask(
  udonObj: TableMask,
  basePosition: Vector3,
  imageAssetContext: ImageAssetContext,
  slotId?: string
): ResoniteObject {
  const hasMaskImage = !!udonObj.images[0]?.identifier;
  const opacity = resolveMaskOpacity(udonObj);
  const colorValue = hasMaskImage ? 1 : 0;

  const builder = ResoniteObjectBuilder.create({
    ...(slotId != null ? { id: slotId } : {}),
    name: udonObj.name,
  })
    .setRotation({ x: 90, y: 0, z: 0 })
    .setPosition({
      x: basePosition.x + udonObj.width / 2,
      y: basePosition.y + TABLE_MASK_Y_OFFSET,
      z: basePosition.z - udonObj.height / 2,
    })
    .setSourceType(udonObj.type)
    .addQuadMesh({
      ...(udonObj.images[0]?.identifier != null
        ? { textureIdentifier: udonObj.images[0]?.identifier }
        : {}),
      dualSided: true,
      size: { x: udonObj.width, y: udonObj.height },
      imageAssetContext,
      color: {
        r: colorValue,
        g: colorValue,
        b: colorValue,
        a: opacity,
        profile: 'Linear',
      },
    })
    .addBoxCollider({ x: udonObj.width, y: udonObj.height, z: TABLE_MASK_COLLIDER_THICKNESS });

  if (!udonObj.isLock) {
    builder.addGrabbable();
  }

  return builder.build();
}
