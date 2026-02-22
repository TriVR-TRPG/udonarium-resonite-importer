/**
 * Converts Udonarium objects to Resonite objects
 */

import { GameTable, UdonariumObject } from '../domain/UdonariumObject';
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
import { ImageAssetContext } from './imageAssetContext';
import {
  ParsedObjectExtensions,
  getTerrainLilyExtension,
} from '../parser/extensions/ObjectExtensions';

interface ConverterOptions {
  enableCharacterColliderOnLockedTerrain?: boolean;
}

export function convertPosition(x: number, y: number, z: number): Vector3 {
  return {
    x: x * SCALE_FACTOR,
    y: z * SCALE_FACTOR,
    z: -y * SCALE_FACTOR,
  };
}

export function convertSize(size: number): Vector3 {
  return {
    x: size,
    y: size,
    z: size,
  };
}

export function convertObjectWithTextures(
  udonObj: UdonariumObject,
  imageAssetContext: ImageAssetContext,
  options?: ConverterOptions,
  extensions?: ParsedObjectExtensions
): ResoniteObject {
  const position = convertPosition(udonObj.position.x, udonObj.position.y, udonObj.position.z);

  switch (udonObj.type) {
    case 'character':
      return convertCharacter(udonObj, position, convertSize, imageAssetContext);
    case 'dice-symbol':
      return convertDiceSymbol(udonObj, position, convertSize, imageAssetContext);
    case 'terrain':
      return convertTerrain(
        udonObj,
        position,
        imageAssetContext,
        options,
        void 0,
        getTerrainLilyExtension(udonObj, extensions)
      );
    case 'table':
      return convertTable(
        udonObj,
        position,
        imageAssetContext,
        (obj: UdonariumObject) =>
          convertObjectWithTextures(obj, imageAssetContext, options, extensions),
        options
      );
    case 'table-mask':
      return convertTableMask(udonObj, position, imageAssetContext);
    case 'card':
      return convertCard(udonObj, position, imageAssetContext);
    case 'card-stack':
      return convertCardStack(
        udonObj,
        position,
        (obj: UdonariumObject) =>
          convertObjectWithTextures(obj, imageAssetContext, options, extensions),
        imageAssetContext
      );
    case 'text-note':
      return convertTextNote(udonObj, position);
    default: {
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

export function convertObjectsWithImageAssetContext(
  udonObjects: UdonariumObject[],
  imageAssetContext: ImageAssetContext,
  options?: ConverterOptions,
  extensions?: ParsedObjectExtensions
): ResoniteObject[] {
  const converted = udonObjects.map((obj) =>
    convertObjectWithTextures(obj, imageAssetContext, options, extensions)
  );
  return applyGameTableVisibility(converted, udonObjects);
}
