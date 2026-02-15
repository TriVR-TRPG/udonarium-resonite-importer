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
 * Scale for the import root group slot.
 * This applies uniformly to all imported objects after conversion.
 */
export const IMPORT_GROUP_SCALE = 1;

/**
 * Tag applied to import root container slots.
 * Existing roots with this tag are deleted before each new import.
 */
export const IMPORT_ROOT_TAG = 'udonarium-resonite-importer:root';

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
 * ResoniteLink version that fixtures and compatibility checks were last validated against.
 * If runtime version differs, import can continue but behavior may have changed.
 */
export const VERIFIED_RESONITE_LINK_VERSION = '0.7.0.0';

export interface KnownImageDefinition {
  url: string;
  aspectRatio: number;
  hasAlpha: boolean;
}

/**
 * Known Udonarium image identifiers with external URL and aspect ratio metadata.
 * ratio = height / width
 */
export const KNOWN_IMAGES: ReadonlyMap<string, KnownImageDefinition> = new Map([
  [
    'testTableBackgroundImage_image',
    { url: 'https://udonarium.app/assets/images/BG10a_80.jpg', aspectRatio: 0.75, hasAlpha: false },
  ],
  [
    'testCharacter_1_image',
    { url: 'https://udonarium.app/assets/images/mon_052.gif', aspectRatio: 1.2, hasAlpha: true },
  ],
  [
    'testCharacter_3_image',
    { url: 'https://udonarium.app/assets/images/mon_128.gif', aspectRatio: 1.1, hasAlpha: true },
  ],
  [
    'testCharacter_4_image',
    { url: 'https://udonarium.app/assets/images/mon_150.gif', aspectRatio: 1.3, hasAlpha: true },
  ],
  [
    'testCharacter_5_image',
    { url: 'https://udonarium.app/assets/images/mon_211.gif', aspectRatio: 1.2, hasAlpha: true },
  ],
  [
    'testCharacter_6_image',
    { url: 'https://udonarium.app/assets/images/mon_135.gif', aspectRatio: 1, hasAlpha: true },
  ],
  [
    'none_icon',
    {
      url: 'https://udonarium.app/assets/images/ic_account_circle_black_24dp_2x.png',
      aspectRatio: 1,
      hasAlpha: true,
    },
  ],
]);

/**
 * Known aspect ratios for external URL/path based identifiers.
 * ratio = height / width
 */
export const KNOWN_EXTERNAL_IMAGE_ASPECT_RATIOS: ReadonlyMap<string, number> = new Map([
  ['assets/images/ic_account_circle_black_24dp_2x.png', 1],
  ['assets/images/BG10a_80.jpg', 0.75],
]);

/**
 * Known alpha flags for external URL/path based identifiers.
 */
export const KNOWN_EXTERNAL_IMAGE_ALPHA_FLAGS: ReadonlyMap<string, boolean> = new Map([
  ['assets/images/ic_account_circle_black_24dp_2x.png', true],
  ['assets/images/BG10a_80.jpg', false],
]);

/**
 * Prefix-based known aspect ratios for external URL/path based identifiers.
 * ratio = height / width
 */
export const KNOWN_EXTERNAL_IMAGE_ASPECT_RATIO_PREFIXES: ReadonlyArray<{
  prefix: string;
  ratio: number;
}> = [{ prefix: 'assets/images/trump/', ratio: 1.5 }];

/**
 * Prefix-based alpha flags for external URL/path based identifiers.
 */
export const KNOWN_EXTERNAL_IMAGE_ALPHA_PREFIXES: ReadonlyArray<{
  prefix: string;
  hasAlpha: boolean;
}> = [{ prefix: 'assets/images/trump/', hasAlpha: false }];

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
