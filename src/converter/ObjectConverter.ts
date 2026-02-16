/**
 * Converts Udonarium objects to Resonite objects
 */

import { randomUUID } from 'crypto';
import { GameTable, UdonariumObject } from '../domain/UdonariumObject';
import { ImageBlendMode } from '../config/MappingConfig';
import { ResoniteObject, Vector3 } from '../domain/ResoniteObject';
import { SCALE_FACTOR } from '../config/MappingConfig';
import { applyCharacterConversion } from './objectConverters/characterConverter';
import { applyDiceSymbolConversion } from './objectConverters/diceSymbolConverter';
import { applyCardConversion } from './objectConverters/cardConverter';
import { applyCardStackConversion } from './objectConverters/cardStackConverter';
import { applyTerrainConversion } from './objectConverters/terrainConverter';
import { applyTableConversion } from './objectConverters/tableConverter';
import { applyTableMaskConversion } from './objectConverters/tableMaskConverter';
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
  textureMap?: Map<string, string>,
  imageAspectRatioMap?: Map<string, number>,
  imageBlendModeMap?: Map<string, ImageBlendMode>
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
      applyCharacterConversion(
        udonObj,
        resoniteObj,
        convertSize,
        textureMap,
        imageAspectRatioMap,
        imageBlendModeMap
      );
      break;
    case 'dice-symbol':
      applyDiceSymbolConversion(
        udonObj,
        resoniteObj,
        convertSize,
        textureMap,
        imageAspectRatioMap,
        imageBlendModeMap
      );
      break;
    case 'terrain':
      applyTerrainConversion(udonObj, resoniteObj, textureMap, imageBlendModeMap);
      break;
    case 'table':
      applyTableConversion(
        udonObj,
        resoniteObj,
        textureMap,
        (obj) => convertObjectWithTextures(obj, textureMap, imageAspectRatioMap, imageBlendModeMap),
        imageBlendModeMap
      );
      break;
    case 'table-mask':
      applyTableMaskConversion(udonObj, resoniteObj, textureMap);
      break;
    case 'card':
      applyCardConversion(udonObj, resoniteObj, textureMap, imageAspectRatioMap, imageBlendModeMap);
      break;
    case 'card-stack':
      applyCardStackConversion(
        udonObj,
        resoniteObj,
        (obj) => convertObjectWithTextures(obj, textureMap, imageAspectRatioMap, imageBlendModeMap),
        imageAspectRatioMap
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

function applyGameTableVisibility(
  convertedObjects: ResoniteObject[],
  udonObjects: UdonariumObject[]
): ResoniteObject[] {
  const tableIndices: number[] = [];
  for (let i = 0; i < udonObjects.length; i += 1) {
    if (udonObjects[i].type === 'table') {
      tableIndices.push(i);
    }
  }

  if (tableIndices.length <= 1) {
    return convertedObjects;
  }

  const selectedTables = tableIndices.filter((index) => (udonObjects[index] as GameTable).selected);
  if (selectedTables.length === 0) {
    return convertedObjects;
  }

  for (const index of tableIndices) {
    convertedObjects[index].isActive = selectedTables.includes(index);
  }

  return convertedObjects;
}

/**
 * Convert multiple Udonarium objects to Resonite objects
 */
export function convertObjects(udonObjects: UdonariumObject[]): ResoniteObject[] {
  const converted = udonObjects.map((obj) => convertObjectWithTextures(obj));
  return applyGameTableVisibility(converted, udonObjects);
}

/**
 * Convert multiple Udonarium objects using imported texture URL map.
 */
export function convertObjectsWithTextureMap(
  udonObjects: UdonariumObject[],
  textureMap: Map<string, string>,
  imageAspectRatioMap?: Map<string, number>,
  imageBlendModeMap?: Map<string, ImageBlendMode>
): ResoniteObject[] {
  const converted = udonObjects.map((obj) =>
    convertObjectWithTextures(obj, textureMap, imageAspectRatioMap, imageBlendModeMap)
  );
  return applyGameTableVisibility(converted, udonObjects);
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
