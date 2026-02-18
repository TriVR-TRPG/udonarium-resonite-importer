import { GameTable, UdonariumObject } from '../../domain/UdonariumObject';
import { ImageBlendMode } from '../../config/MappingConfig';
import { ResoniteObject } from '../../domain/ResoniteObject';
import { BlendModeValue, resolveTextureValue } from '../textureUtils';
import { lookupImageBlendMode } from '../imageAspectRatioMap';
import { ResoniteObjectBuilder } from '../ResoniteObjectBuilder';

function resolveBlendMode(
  identifier: string | undefined,
  imageBlendModeMap?: Map<string, ImageBlendMode>
): BlendModeValue {
  if (!imageBlendModeMap) {
    return 'Opaque';
  }
  return lookupImageBlendMode(imageBlendModeMap, identifier) ?? 'Opaque';
}

export function convertTable(
  udonObj: GameTable,
  baseObj: ResoniteObject,
  textureMap?: Map<string, string>,
  convertObject?: (obj: UdonariumObject) => ResoniteObject,
  imageBlendModeMap?: Map<string, ImageBlendMode>
): ResoniteObject {
  const surfaceId = `${baseObj.id}-surface`;
  const textureIdentifier = udonObj.images[0]?.identifier;
  const textureValue = resolveTextureValue(textureIdentifier, textureMap);
  const blendMode = resolveBlendMode(textureIdentifier, imageBlendModeMap);
  const tableVisual = new ResoniteObjectBuilder({
    id: surfaceId,
    name: `${baseObj.name}-surface`,
    position: { x: udonObj.width / 2, y: 0, z: -udonObj.height / 2 },
    rotation: { x: 90, y: 0, z: 0 },
  })
    .addQuadMesh(textureValue, false, { x: udonObj.width, y: udonObj.height }, blendMode)
    .addBoxCollider({ x: udonObj.width, y: udonObj.height, z: 0 })
    .build();

  const convertedChildren =
    convertObject && udonObj.children.length > 0
      ? udonObj.children.map((child) => convertObject(child))
      : [];

  // Keep table container unrotated so child object positions stay stable.
  return new ResoniteObjectBuilder({
    ...baseObj,
    rotation: { x: 0, y: 0, z: 0 },
  })
    .addChildren([tableVisual, ...convertedChildren])
    .build();
}
