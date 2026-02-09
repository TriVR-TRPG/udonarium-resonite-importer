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
 * Udonarium size 1 = 1m (1 grid) in Resonite
 */
export const SIZE_MULTIPLIER = 1.0;

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
 * Get ResoniteLink port from environment variable
 * Returns undefined if not set (port is required)
 */
export function getResoniteLinkPort(): number | undefined {
  const portStr = process.env.RESONITELINK_PORT;
  if (!portStr) {
    return undefined;
  }
  const port = parseInt(portStr, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    return undefined;
  }
  return port;
}

/**
 * Get ResoniteLink host from environment variable
 * Defaults to 'localhost' if not set
 */
export function getResoniteLinkHost(): string {
  return process.env.RESONITELINK_HOST || 'localhost';
}

/**
 * Default ResoniteLink settings (for backward compatibility)
 * Note: Port should be provided via environment variable or CLI argument
 */
export const DEFAULT_RESONITE_LINK = {
  host: 'localhost',
};

/**
 * Known Udonarium image identifiers mapped to their asset URLs.
 * These are built-in images used by default Udonarium save data.
 */
export const KNOWN_IMAGE_IDENTIFIERS: ReadonlyMap<string, string> = new Map([
  ['testTableBackgroundImage_image', 'https://udonarium.app/assets/images/BG10a_80.jpg'],
  ['testCharacter_1_image', 'https://udonarium.app/assets/images/mon_052.gif'],
  ['testCharacter_3_image', 'https://udonarium.app/assets/images/mon_128.gif'],
  ['testCharacter_4_image', 'https://udonarium.app/assets/images/mon_150.gif'],
  ['testCharacter_5_image', 'https://udonarium.app/assets/images/mon_211.gif'],
  ['testCharacter_6_image', 'https://udonarium.app/assets/images/mon_135.gif'],
]);

/**
 * Supported object type tags in Udonarium XML
 */
export const SUPPORTED_TAGS = [
  'character',
  'card',
  'card-stack',
  'terrain',
  'table',
  'game-table',
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
