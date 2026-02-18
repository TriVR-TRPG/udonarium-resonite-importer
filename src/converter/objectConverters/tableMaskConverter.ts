import { TableMask } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';
import {
  buildBoxColliderComponent,
  buildGrabbableComponent,
  buildQuadMeshComponents,
  resolveTextureValue,
} from './componentBuilders';

const TABLE_MASK_Y_OFFSET = 0.002;
const TABLE_MASK_COLLIDER_THICKNESS = 0.01;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function resolveMaskOpacity(mask: TableMask): number {
  const opacityRaw = mask.properties.get('opacity');
  if (typeof opacityRaw !== 'number') {
    return 1;
  }
  return clamp01(opacityRaw / 100);
}

export function convertTableMask(
  udonObj: TableMask,
  baseObj: ResoniteObject,
  textureMap?: Map<string, string>
): ResoniteObject {
  const hasMaskImage = !!udonObj.images[0]?.identifier;
  const textureValue = resolveTextureValue(udonObj.images[0]?.identifier, textureMap);
  const opacity = resolveMaskOpacity(udonObj);
  const colorValue = hasMaskImage ? 1 : 0;
  const components = [
    ...buildQuadMeshComponents(baseObj.id, textureValue, true, {
      x: udonObj.width,
      y: udonObj.height,
    }),
    buildBoxColliderComponent(baseObj.id, {
      x: udonObj.width,
      y: udonObj.height,
      z: TABLE_MASK_COLLIDER_THICKNESS,
    }),
    ...(udonObj.isLock ? [] : [buildGrabbableComponent(baseObj.id)]),
  ];

  const material = components.find(
    (component) => component.type === '[FrooxEngine]FrooxEngine.XiexeToonMaterial'
  );
  if (material) {
    material.fields = {
      ...material.fields,
      BlendMode: { $type: 'enum', value: 'Alpha', enumType: 'BlendMode' },
      Color: {
        $type: 'colorX',
        value: {
          r: colorValue,
          g: colorValue,
          b: colorValue,
          a: opacity,
          profile: 'Linear',
        },
      },
    };
  }

  // Udonarium positions are edge-based; Resonite uses center-based transforms.
  return {
    ...baseObj,
    rotation: { x: 90, y: 0, z: 0 },
    position: {
      x: baseObj.position.x + udonObj.width / 2,
      y: baseObj.position.y + TABLE_MASK_Y_OFFSET,
      z: baseObj.position.z - udonObj.height / 2,
    },
    components,
  };
}
