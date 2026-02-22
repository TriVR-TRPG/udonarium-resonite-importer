import { Terrain } from '../../domain/UdonariumObject';

export interface TerrainLilyExtension {
  altitude: number;
  isSlope: boolean;
  slopeDirection: number;
}

export interface ParsedObjectExtensions {
  terrainLilyByObjectKey: Record<string, TerrainLilyExtension>;
}

export const DEFAULT_TERRAIN_LILY_EXTENSION: TerrainLilyExtension = {
  altitude: 0,
  isSlope: false,
  slopeDirection: 0,
};

export function createEmptyParsedObjectExtensions(): ParsedObjectExtensions {
  return {
    terrainLilyByObjectKey: {},
  };
}

export function mergeParsedObjectExtensions(
  target: ParsedObjectExtensions,
  source: ParsedObjectExtensions
): void {
  Object.assign(target.terrainLilyByObjectKey, source.terrainLilyByObjectKey);
}

export function buildTerrainExtensionKey(terrain: Terrain): string {
  return [
    terrain.id,
    terrain.name,
    terrain.position.x,
    terrain.position.y,
    terrain.position.z,
    terrain.width,
    terrain.height,
    terrain.depth,
    terrain.mode,
    terrain.rotate,
  ].join('|');
}

export function getTerrainLilyExtension(
  terrain: Terrain,
  extensions?: ParsedObjectExtensions
): TerrainLilyExtension {
  return (
    extensions?.terrainLilyByObjectKey[buildTerrainExtensionKey(terrain)] ??
    DEFAULT_TERRAIN_LILY_EXTENSION
  );
}
