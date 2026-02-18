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

export function convertTerrain(
  udonObj: Terrain,
  baseObj: ResoniteObject,
  textureMap?: Map<string, string>,
  imageBlendModeMap?: Map<string, ImageBlendMode>
): ResoniteObject {
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
  const colliderComponent = buildBoxColliderComponent(baseObj.id, {
    x: udonObj.width,
    y: udonObj.height,
    z: udonObj.depth,
  });
  if (udonObj.isLocked) {
    colliderComponent.fields.CharacterCollider = { $type: 'bool', value: true };
  }
  const components = [
    colliderComponent,
    ...(udonObj.isLocked ? [] : [buildGrabbableComponent(baseObj.id)]),
  ];

  const topId = `${baseObj.id}-top`;
  const wallsId = `${baseObj.id}-walls`;
  const frontId = `${wallsId}-front`;
  const backId = `${wallsId}-back`;
  const leftId = `${wallsId}-left`;
  const rightId = `${wallsId}-right`;
  const hideWalls = udonObj.mode === 1;

  const topSurface: ResoniteObject = {
    id: topId,
    name: `${baseObj.name}-top`,
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
    name: `${baseObj.name}-walls`,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    isActive: !hideWalls,
    textures: [],
    components: [],
    children: [
      {
        id: frontId,
        name: `${baseObj.name}-front`,
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
        name: `${baseObj.name}-back`,
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
        name: `${baseObj.name}-left`,
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
        name: `${baseObj.name}-right`,
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

  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  return {
    ...baseObj,
    rotation: { x: 0, y: udonObj.rotate, z: 0 },
    position: {
      x: baseObj.position.x + udonObj.width / 2,
      y: baseObj.position.y + udonObj.height / 2,
      z: baseObj.position.z - udonObj.depth / 2,
    },
    components,
    children: [{ ...topSurface }, wallsContainer],
  };
}
