/**
 * Converts Udonarium objects to Resonite objects
 */

import { UdonariumObject } from './UdonariumObject';
import { ResoniteObject, Vector3 } from './ResoniteObject';
import { SCALE_FACTOR, SIZE_MULTIPLIER } from '../config/MappingConfig';

/**
 * Convert Udonarium 2D coordinates to Resonite 3D coordinates
 * Udonarium: +X right, +Y down (CSS-like)
 * Resonite: +X right, +Y up, +Z forward (Y-up system)
 */
export function convertPosition(x: number, y: number): Vector3 {
  return {
    x: x * SCALE_FACTOR,
    y: 0, // Table height
    z: -y * SCALE_FACTOR,
  };
}

/**
 * Convert Udonarium size to Resonite scale
 */
export function convertSize(size: number): Vector3 {
  const scale = size * SIZE_MULTIPLIER;
  return {
    x: scale,
    y: scale,
    z: scale,
  };
}

/**
 * Convert a single Udonarium object to Resonite object
 */
export function convertObject(udonObj: UdonariumObject): ResoniteObject {
  const position = convertPosition(udonObj.position.x, udonObj.position.y);

  const resoniteObj: ResoniteObject = {
    id: `udonarium_${udonObj.type}_${udonObj.id}`,
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
      resoniteObj.scale = convertSize(udonObj.size);
      break;
    case 'terrain':
      resoniteObj.scale = {
        x: udonObj.width * SIZE_MULTIPLIER,
        y: udonObj.height * SIZE_MULTIPLIER,
        z: udonObj.depth * SIZE_MULTIPLIER,
      };
      break;
    case 'table':
      resoniteObj.scale = {
        x: udonObj.width * SCALE_FACTOR,
        y: 0.01, // Thin table
        z: udonObj.height * SCALE_FACTOR,
      };
      resoniteObj.position.y = -0.01; // Slightly below origin
      break;
    case 'card':
    case 'card-stack':
      resoniteObj.scale = { x: 0.06, y: 0.001, z: 0.09 }; // Standard card size
      break;
    case 'text-note':
      resoniteObj.scale = { x: 0.1, y: 0.1, z: 0.1 };
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
  return udonObjects.map(convertObject);
}
