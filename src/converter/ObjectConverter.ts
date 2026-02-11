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
      applyTableConversion(udonObj, resoniteObj, textureMap, (obj) =>
        convertObjectWithTextures(obj, textureMap)
      );
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

  return resoniteObj;
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
