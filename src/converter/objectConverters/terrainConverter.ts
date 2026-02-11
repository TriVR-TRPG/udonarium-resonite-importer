import { Terrain } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';
import {
  buildBoxColliderComponent,
  buildQuadMeshComponents,
  resolveTextureValue,
} from './componentBuilders';

export function applyTerrainConversion(
  udonObj: Terrain,
  resoniteObj: ResoniteObject,
  textureMap?: Map<string, string>
): void {
  const topTextureIdentifier =
    udonObj.floorImage?.identifier ??
    udonObj.wallImage?.identifier ??
    udonObj.images[0]?.identifier;
  const sideTextureIdentifier =
    udonObj.wallImage?.identifier ??
    udonObj.floorImage?.identifier ??
    udonObj.images[0]?.identifier;
  const topTextureValue = resolveTextureValue(topTextureIdentifier, textureMap);
  const sideTextureValue = resolveTextureValue(sideTextureIdentifier, textureMap);
  // Udonarium: width=X, height=Y(horizontal), depth=Z(vertical)
  // Resonite (Y-up): X=width, Y=depth(vertical), Z=height(horizontal)
  resoniteObj.components = [
    buildBoxColliderComponent(resoniteObj.id, {
      x: udonObj.width,
      y: udonObj.depth,
      z: udonObj.height,
    }),
  ];

  const topId = `${resoniteObj.id}-top`;
  const frontId = `${resoniteObj.id}-front`;
  const backId = `${resoniteObj.id}-back`;
  const leftId = `${resoniteObj.id}-left`;
  const rightId = `${resoniteObj.id}-right`;

  resoniteObj.children = [
    {
      id: topId,
      name: `${resoniteObj.name}-top`,
      position: { x: 0, y: udonObj.depth / 2, z: 0 },
      rotation: { x: 90, y: 0, z: 0 },
      textures: [],
      components: buildQuadMeshComponents(topId, topTextureValue, false, {
        x: udonObj.width,
        y: udonObj.height,
      }),
      children: [],
    },
    {
      id: frontId,
      name: `${resoniteObj.name}-front`,
      position: { x: 0, y: 0, z: -udonObj.height / 2 },
      rotation: { x: 0, y: 0, z: 0 },
      textures: [],
      components: buildQuadMeshComponents(frontId, sideTextureValue, false, {
        x: udonObj.width,
        y: udonObj.depth,
      }),
      children: [],
    },
    {
      id: backId,
      name: `${resoniteObj.name}-back`,
      position: { x: 0, y: 0, z: udonObj.height / 2 },
      rotation: { x: 0, y: 180, z: 0 },
      textures: [],
      components: buildQuadMeshComponents(backId, sideTextureValue, false, {
        x: udonObj.width,
        y: udonObj.depth,
      }),
      children: [],
    },
    {
      id: leftId,
      name: `${resoniteObj.name}-left`,
      position: { x: -udonObj.width / 2, y: 0, z: 0 },
      rotation: { x: 0, y: 90, z: 0 },
      textures: [],
      components: buildQuadMeshComponents(leftId, sideTextureValue, false, {
        x: udonObj.height,
        y: udonObj.depth,
      }),
      children: [],
    },
    {
      id: rightId,
      name: `${resoniteObj.name}-right`,
      position: { x: udonObj.width / 2, y: 0, z: 0 },
      rotation: { x: 0, y: -90, z: 0 },
      textures: [],
      components: buildQuadMeshComponents(rightId, sideTextureValue, false, {
        x: udonObj.height,
        y: udonObj.depth,
      }),
      children: [],
    },
  ];

  // Udonarium positions at object bottom; Resonite positions at center
  resoniteObj.position.y += udonObj.depth / 2;
}
