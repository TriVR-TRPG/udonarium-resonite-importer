import { TableMask } from '../UdonariumObject';
import { ResoniteObject } from '../ResoniteObject';
import {
  buildBoxColliderComponent,
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

export function applyTableMaskConversion(
  udonObj: TableMask,
  resoniteObj: ResoniteObject,
  textureMap?: Map<string, string>
): void {
  resoniteObj.rotation = { x: 90, y: 0, z: 0 };
  resoniteObj.position.x += udonObj.width / 2;
  resoniteObj.position.z -= udonObj.height / 2;
  resoniteObj.position.y += TABLE_MASK_Y_OFFSET;

  const hasMaskImage = !!udonObj.images[0]?.identifier;
  const textureValue = resolveTextureValue(udonObj.images[0]?.identifier, textureMap);
  const opacity = resolveMaskOpacity(udonObj);
  const colorValue = hasMaskImage ? 1 : 0;
  resoniteObj.components = [
    ...buildQuadMeshComponents(resoniteObj.id, textureValue, true, {
      x: udonObj.width,
      y: udonObj.height,
    }),
    buildBoxColliderComponent(resoniteObj.id, {
      x: udonObj.width,
      y: udonObj.height,
      z: TABLE_MASK_COLLIDER_THICKNESS,
    }),
  ];

  const material = resoniteObj.components.find(
    (component) => component.type === '[FrooxEngine]FrooxEngine.XiexeToonMaterial'
  );
  if (!material) {
    return;
  }

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
