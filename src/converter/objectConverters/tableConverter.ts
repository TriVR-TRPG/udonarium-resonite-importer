import { GameTable, UdonariumObject } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';
import {
  buildBoxColliderComponent,
  buildQuadMeshComponents,
  resolveTextureValue,
} from './componentBuilders';

export function applyTableConversion(
  udonObj: GameTable,
  resoniteObj: ResoniteObject,
  textureMap?: Map<string, string>,
  convertObject?: (obj: UdonariumObject) => ResoniteObject
): void {
  // Keep table container unrotated so child object positions stay stable.
  resoniteObj.rotation = { x: 0, y: 0, z: 0 };
  resoniteObj.components = [];

  const surfaceId = `${resoniteObj.id}-surface`;
  const textureValue = resolveTextureValue(udonObj.images[0]?.identifier, textureMap);
  const tableVisual: ResoniteObject = {
    id: surfaceId,
    name: `${resoniteObj.name}-surface`,
    position: { x: udonObj.width / 2, y: 0, z: -udonObj.height / 2 },
    rotation: { x: 90, y: 0, z: 0 },
    textures: [],
    components: [
      ...buildQuadMeshComponents(surfaceId, textureValue, false, {
        x: udonObj.width,
        y: udonObj.height,
      }),
      buildBoxColliderComponent(surfaceId, {
        x: udonObj.width,
        y: udonObj.height,
        z: 0,
      }),
    ],
    children: [],
  };

  const convertedChildren =
    convertObject && udonObj.children.length > 0
      ? udonObj.children.map((child) => convertObject(child))
      : [];
  resoniteObj.children = [tableVisual, ...convertedChildren];
}
