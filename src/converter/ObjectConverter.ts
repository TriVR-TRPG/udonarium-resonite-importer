/**
 * Converts Udonarium objects to Resonite objects
 */

import { GameTable, UdonariumObject } from '../domain/UdonariumObject';
import { ImageBlendMode } from '../config/MappingConfig';
import { ResoniteObject, Vector3 } from '../domain/ResoniteObject';
import { SCALE_FACTOR } from '../config/MappingConfig';
import { convertCharacter } from './objectConverters/characterConverter';
import { convertDiceSymbol } from './objectConverters/diceSymbolConverter';
import { convertCard } from './objectConverters/cardConverter';
import { convertCardStack } from './objectConverters/cardStackConverter';
import { convertTerrain } from './objectConverters/terrainConverter';
import { convertTable } from './objectConverters/tableConverter';
import { convertTableMask } from './objectConverters/tableMaskConverter';
import { convertTextNote } from './objectConverters/textNoteConverter';
import { ResoniteObjectBuilder } from './ResoniteObjectBuilder';

interface ConverterOptions {
  enableCharacterColliderOnLockedTerrain?: boolean;
}

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
  return convertObjectWithTextures(udonObj, new Map());
}

function convertObjectWithTextures(
  udonObj: UdonariumObject,
  textureMap?: Map<string, string>,
  imageAspectRatioMap?: Map<string, number>,
  imageBlendModeMap?: Map<string, ImageBlendMode>,
  options?: ConverterOptions
): ResoniteObject {
  const position = convertPosition(udonObj.position.x, udonObj.position.y, udonObj.position.z);

  // Apply type-specific conversions
  switch (udonObj.type) {
    case 'character':
      return convertCharacter(
        udonObj,
        position,
        convertSize,
        textureMap,
        imageAspectRatioMap,
        imageBlendModeMap
      );
    case 'dice-symbol':
      return convertDiceSymbol(
        udonObj,
        position,
        convertSize,
        textureMap,
        imageAspectRatioMap,
        imageBlendModeMap
      );
    case 'terrain':
      return convertTerrain(udonObj, position, textureMap, imageBlendModeMap, undefined, options);
    case 'table':
      return convertTable(
        udonObj,
        position,
        textureMap,
        (obj) =>
          convertObjectWithTextures(
            obj,
            textureMap,
            imageAspectRatioMap,
            imageBlendModeMap,
            options
          ),
        imageBlendModeMap,
        undefined,
        options
      );
    case 'table-mask':
      return convertTableMask(udonObj, position, textureMap);
    case 'card':
      return convertCard(udonObj, position, textureMap, imageAspectRatioMap, imageBlendModeMap);
    case 'card-stack':
      return convertCardStack(
        udonObj,
        position,
        (obj) =>
          convertObjectWithTextures(
            obj,
            textureMap,
            imageAspectRatioMap,
            imageBlendModeMap,
            options
          ),
        imageAspectRatioMap
      );
    case 'text-note':
      return convertTextNote(udonObj, position);
    default: {
      // Keep fallback for forward-compatibility when new object types are introduced.
      const unknownObj = udonObj as UdonariumObject;
      const builder = ResoniteObjectBuilder.create({ name: unknownObj.name })
        .setPosition(position)
        .setRotation({ x: 0, y: 0, z: 0 })
        .setSourceType(unknownObj.type);
      return builder.build();
    }
  }
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
  const converted = udonObjects.map((obj) => convertObjectWithTextures(obj, new Map()));
  return applyGameTableVisibility(converted, udonObjects);
}

/**
 * Convert multiple Udonarium objects using imported texture URL map.
 */
export function convertObjectsWithTextureMap(
  udonObjects: UdonariumObject[],
  textureMap: Map<string, string>,
  imageAspectRatioMap?: Map<string, number>,
  imageBlendModeMap?: Map<string, ImageBlendMode>,
  options?: ConverterOptions
): ResoniteObject[] {
  const converted = udonObjects.map((obj) =>
    convertObjectWithTextures(obj, textureMap, imageAspectRatioMap, imageBlendModeMap, options)
  );
  return applyGameTableVisibility(converted, udonObjects);
}
