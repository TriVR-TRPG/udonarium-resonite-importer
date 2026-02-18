import { Terrain } from '../../domain/UdonariumObject';
import { ImageBlendMode } from '../../config/MappingConfig';
import { ResoniteObject } from '../../domain/ResoniteObject';
import {
  buildBoxColliderComponent,
  buildGrabbableComponent,
  buildQuadMeshComponents,
  BlendModeValue,
  resolveTextureValue,
} from './componentBuilders';
import { lookupImageBlendMode } from '../imageAspectRatioMap';

function resolveBlendMode(
  identifier: string | undefined,
  imageBlendModeMap?: Map<string, ImageBlendMode>
): BlendModeValue {
  if (!imageBlendModeMap) {
    return 'Opaque';
  }
  return lookupImageBlendMode(imageBlendModeMap, identifier) ?? 'Opaque';
}

export function applyTerrainConversion(
  udonObj: Terrain,
  resoniteObj: ResoniteObject,
  textureMap?: Map<string, string>,
  imageBlendModeMap?: Map<string, ImageBlendMode>
): void {
  resoniteObj.rotation = { x: 0, y: udonObj.rotate, z: 0 };
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
  const topBlendMode = resolveBlendMode(topTextureIdentifier, imageBlendModeMap);
  const sideBlendMode = resolveBlendMode(sideTextureIdentifier, imageBlendModeMap);
  // Axis mapping: width -> X, height -> Y, depth -> Z
  const colliderComponent = buildBoxColliderComponent(resoniteObj.id, {
    x: udonObj.width,
    y: udonObj.height,
    z: udonObj.depth,
  });
  if (udonObj.isLocked) {
    colliderComponent.fields.CharacterCollider = { $type: 'bool', value: true };
  }
  resoniteObj.components = [colliderComponent];
  if (!udonObj.isLocked) {
    resoniteObj.components.push(buildGrabbableComponent(resoniteObj.id));
  }

  const topId = `${resoniteObj.id}-top`;
  const wallsId = `${resoniteObj.id}-walls`;
  const frontId = `${wallsId}-front`;
  const backId = `${wallsId}-back`;
  const leftId = `${wallsId}-left`;
  const rightId = `${wallsId}-right`;
  const hideWalls = udonObj.mode === 1;

  const topSurface: ResoniteObject = {
    id: topId,
    name: `${resoniteObj.name}-top`,
    position: { x: 0, y: udonObj.height / 2, z: 0 },
    rotation: { x: 90, y: 0, z: 0 },
    textures: [],
    components: buildQuadMeshComponents(
      topId,
      topTextureValue,
      false,
      {
        x: udonObj.width,
        y: udonObj.depth,
      },
      topBlendMode
    ),
    children: [],
  };
  const wallsContainer: ResoniteObject = {
    id: wallsId,
    name: `${resoniteObj.name}-walls`,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    isActive: !hideWalls,
    textures: [],
    components: [],
    children: [
      {
        id: frontId,
        name: `${resoniteObj.name}-front`,
        position: { x: 0, y: 0, z: -udonObj.depth / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        textures: [],
        components: buildQuadMeshComponents(
          frontId,
          sideTextureValue,
          false,
          {
            x: udonObj.width,
            y: udonObj.height,
          },
          sideBlendMode
        ),
        children: [],
      },
      {
        id: backId,
        name: `${resoniteObj.name}-back`,
        position: { x: 0, y: 0, z: udonObj.depth / 2 },
        rotation: { x: 0, y: 180, z: 0 },
        textures: [],
        components: buildQuadMeshComponents(
          backId,
          sideTextureValue,
          false,
          {
            x: udonObj.width,
            y: udonObj.height,
          },
          sideBlendMode
        ),
        children: [],
      },
      {
        id: leftId,
        name: `${resoniteObj.name}-left`,
        position: { x: -udonObj.width / 2, y: 0, z: 0 },
        rotation: { x: 0, y: 90, z: 0 },
        textures: [],
        components: buildQuadMeshComponents(
          leftId,
          sideTextureValue,
          false,
          {
            x: udonObj.depth,
            y: udonObj.height,
          },
          sideBlendMode
        ),
        children: [],
      },
      {
        id: rightId,
        name: `${resoniteObj.name}-right`,
        position: { x: udonObj.width / 2, y: 0, z: 0 },
        rotation: { x: 0, y: -90, z: 0 },
        textures: [],
        components: buildQuadMeshComponents(
          rightId,
          sideTextureValue,
          false,
          {
            x: udonObj.depth,
            y: udonObj.height,
          },
          sideBlendMode
        ),
        children: [],
      },
    ],
  };

  const children: ResoniteObject[] = [
    {
      ...topSurface,
    },
    wallsContainer,
  ];
  resoniteObj.children = children;

  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  resoniteObj.position.x += udonObj.width / 2;
  resoniteObj.position.y += udonObj.height / 2;
  resoniteObj.position.z -= udonObj.depth / 2;
}
