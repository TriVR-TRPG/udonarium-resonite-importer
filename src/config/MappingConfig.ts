/**
 * Configuration for object mapping between Udonarium and Resonite
 */

/**
 * Scale factor for converting Udonarium coordinates to Resonite
 * Udonarium uses pixels (1 grid = 50px)
 * Resonite uses meters
 * 50px = 1m, so 1px = 0.02m
 */
export const SCALE_FACTOR = 0.02;

/**
 * Size multiplier for converting Udonarium size to Resonite scale
 * Udonarium size 1 = 10cm in Resonite
 */
export const SIZE_MULTIPLIER = 0.1;

/**
 * Retry configuration for ResoniteLink connection
 */
export const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  backoffMultiplier: 2,
  maxDelay: 10000, // 10 seconds
};

/**
 * Default ResoniteLink settings
 */
export const DEFAULT_RESONITE_LINK = {
  host: 'localhost',
  port: 7869,
};

/**
 * Supported object type tags in Udonarium XML
 */
export const SUPPORTED_TAGS = [
  'character',
  'card',
  'card-stack',
  'terrain',
  'table',
  'table-mask',
  'text-note',
] as const;

/**
 * Mapping of Udonarium object types to Resonite representations
 */
export const OBJECT_MAPPING = {
  character: {
    meshType: 'Quad',
    description: 'Character token with standing image',
  },
  card: {
    meshType: 'Quad',
    description: 'Double-sided card with front/back textures',
  },
  'card-stack': {
    meshType: 'Cube',
    description: 'Stack of cards with grouping',
  },
  terrain: {
    meshType: 'Cube',
    description: '3D terrain with wall/floor textures',
  },
  table: {
    meshType: 'Quad',
    description: 'Game table surface',
  },
  'table-mask': {
    meshType: 'Quad',
    description: 'Table mask overlay',
  },
  'text-note': {
    meshType: 'UIXText',
    description: 'Shared text note',
  },
} as const;
