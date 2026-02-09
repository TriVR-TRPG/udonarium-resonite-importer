/**
 * Converts Udonarium objects to Resonite objects
 */

import { randomUUID } from 'crypto';
import { UdonariumObject } from './UdonariumObject';
import { ResoniteObject, Vector3 } from './ResoniteObject';
import { SCALE_FACTOR } from '../config/MappingConfig';
import { applyCharacterConversion } from './objectConverters/characterConverter';
import { applyCardConversion } from './objectConverters/cardConverter';
import { applyCardStackConversion } from './objectConverters/cardStackConverter';
import { applyTerrainConversion } from './objectConverters/terrainConverter';
import { applyTableConversion } from './objectConverters/tableConverter';
import { applyTextNoteConversion } from './objectConverters/textNoteConverter';
import { replaceTexturesInValue } from './objectConverters/componentBuilders';

const SLOT_ID_PREFIX = 'udon-imp';
const BOX_COLLIDER_TYPE = '[FrooxEngine]FrooxEngine.BoxCollider';
const QUAD_MESH_TYPE = '[FrooxEngine]FrooxEngine.QuadMesh';
const BOX_MESH_TYPE = '[FrooxEngine]FrooxEngine.BoxMesh';

/**
 * Convert Udonarium 2D coordinates to Resonite 3D coordinates
 * Udonarium: +X right, +Y down (CSS-like)
 * Resonite: +X right, +Y up, +Z forward (Y-up system)
 */
export function convertPosition(x: number, y: number, z: number): Vector3 {
  return {
    x: x * SCALE_FACTOR,
    y: z * SCALE_FACTOR,
    z: -y * SCALE_FACTOR,
  };
}

/**
 * Convert Udonarium size to Resonite scale
 */
export function convertSize(size: number): Vector3 {
  return {
    x: size,
    y: size,
    z: size,
  };
}

/**
 * Convert a single Udonarium object to Resonite object
 */
export function convertObject(udonObj: UdonariumObject): ResoniteObject {
  return convertObjectWithTextures(udonObj);
}

function convertObjectWithTextures(
  udonObj: UdonariumObject,
  textureMap?: Map<string, string>
): ResoniteObject {
  const position = convertPosition(udonObj.position.x, udonObj.position.y, udonObj.position.z);

  const slotId = `${SLOT_ID_PREFIX}-${randomUUID()}`;
  const resoniteObj: ResoniteObject = {
    id: slotId,
    name: udonObj.name,
    position,
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    textures: udonObj.images.map((img) => img.identifier),
    components: [],
    children: [],
  };

  // Apply type-specific conversions
  switch (udonObj.type) {
    case 'character':
      applyCharacterConversion(udonObj, resoniteObj, convertSize, textureMap);
      break;
    case 'terrain':
      applyTerrainConversion(udonObj, resoniteObj, textureMap);
      break;
    case 'table':
      applyTableConversion(udonObj, resoniteObj, textureMap);
      break;
    case 'card':
      applyCardConversion(udonObj, resoniteObj, textureMap);
      break;
    case 'card-stack':
      applyCardStackConversion(udonObj, resoniteObj, (obj) =>
        convertObjectWithTextures(obj, textureMap)
      );
      break;
    case 'text-note':
      applyTextNoteConversion(udonObj, resoniteObj);
      break;
    default:
      break;
  }

  ensureBoxCollider(resoniteObj);
  return resoniteObj;
}

function ensureBoxCollider(resoniteObj: ResoniteObject): void {
  const hasBoxCollider = resoniteObj.components.some(
    (component) => component.type === BOX_COLLIDER_TYPE
  );
  if (hasBoxCollider) {
    return;
  }

  resoniteObj.components.push({
    id: `${resoniteObj.id}-collider`,
    type: BOX_COLLIDER_TYPE,
    fields: {
      Size: {
        $type: 'float3',
        value: resolveColliderSizeByMesh(resoniteObj),
      },
    },
  });
}

function resolveColliderSizeByMesh(resoniteObj: ResoniteObject): Vector3 {
  const boxMesh = resoniteObj.components.find((component) => component.type === BOX_MESH_TYPE);
  if (boxMesh) {
    return readBoxMeshSize(boxMesh.fields) ?? { x: 1, y: 1, z: 1 };
  }

  const quadMesh = resoniteObj.components.find((component) => component.type === QUAD_MESH_TYPE);
  if (quadMesh) {
    return readQuadMeshSize(quadMesh.fields) ?? { x: 1, y: 1, z: 0.01 };
  }

  // Fallback for meshless objects (e.g., card-stack parent, UI-only objects)
  return { x: 1, y: 1, z: 1 };
}

function readBoxMeshSize(fields: Record<string, unknown>): Vector3 | undefined {
  const size = fields.Size as { value?: { x?: number; y?: number; z?: number } } | undefined;
  if (
    size?.value &&
    typeof size.value.x === 'number' &&
    typeof size.value.y === 'number' &&
    typeof size.value.z === 'number'
  ) {
    return { x: size.value.x, y: size.value.y, z: size.value.z };
  }
  return undefined;
}

function readQuadMeshSize(fields: Record<string, unknown>): Vector3 | undefined {
  const size = fields.Size as { value?: { x?: number; y?: number } } | undefined;
  if (size?.value && typeof size.value.x === 'number' && typeof size.value.y === 'number') {
    return { x: size.value.x, y: size.value.y, z: 0.01 };
  }
  return undefined;
}

/**
 * Convert multiple Udonarium objects to Resonite objects
 */
export function convertObjects(udonObjects: UdonariumObject[]): ResoniteObject[] {
  return udonObjects.map((obj) => convertObjectWithTextures(obj));
}

/**
 * Convert multiple Udonarium objects using imported texture URL map.
 */
export function convertObjectsWithTextureMap(
  udonObjects: UdonariumObject[],
  textureMap: Map<string, string>
): ResoniteObject[] {
  return udonObjects.map((obj) => convertObjectWithTextures(obj, textureMap));
}

/**
 * Resolve texture placeholders in component fields.
 * Placeholders use the format "texture://<identifier>".
 */
export function resolveTexturePlaceholders(
  objects: ResoniteObject[],
  textureMap: Map<string, string>
): void {
  for (const obj of objects) {
    for (const component of obj.components) {
      component.fields = replaceTexturesInValue(component.fields, textureMap) as Record<
        string,
        unknown
      >;
    }
    if (obj.children.length > 0) {
      resolveTexturePlaceholders(obj.children, textureMap);
    }
  }
}
