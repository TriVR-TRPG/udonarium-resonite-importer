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
  blendMode: ImageBlendMode;
}

export type ImageBlendMode = 'Cutout' | 'Opaque' | 'Alpha';

interface KnownExternalImageMetadata {
  path: string;
  aspectRatio: number;
  blendMode: ImageBlendMode;
}

interface KnownExternalImagePrefixMetadata {
  prefix: string;
  aspectRatio: number;
  blendMode: ImageBlendMode;
}

function extractPathname(urlOrPath: string): string {
  try {
    const url = new URL(urlOrPath);
    return url.pathname.replace(/^\/+/, '');
  } catch {
    return urlOrPath.replace(/^\/+/, '');
  }
}

function toAspectRatioMap<T extends { aspectRatio: number }>(
  entries: readonly T[],
  keySelector: (entry: T) => string
): ReadonlyMap<string, number> {
  return new Map(entries.map((entry) => [keySelector(entry), entry.aspectRatio]));
}

function toBlendModeMap<T extends { blendMode: ImageBlendMode }>(
  entries: readonly T[],
  keySelector: (entry: T) => string
): ReadonlyMap<string, ImageBlendMode> {
  return new Map(entries.map((entry) => [keySelector(entry), entry.blendMode]));
}

/**
 * Known Udonarium image identifiers with external URL and aspect ratio metadata.
 * ratio = height / width
 */
const KNOWN_IMAGE_ENTRIES: ReadonlyArray<readonly [string, KnownImageDefinition]> = [
  [
    'testTableBackgroundImage_image',
    {
      url: 'https://udonarium.app/assets/images/BG10a_80.jpg',
      aspectRatio: 0.75,
      blendMode: 'Opaque',
    },
  ],
  [
    'testCharacter_1_image',
    {
      url: 'https://udonarium.app/assets/images/mon_052.gif',
      aspectRatio: 1.2,
      blendMode: 'Cutout',
    },
  ],
  [
    'testCharacter_3_image',
    {
      url: 'https://udonarium.app/assets/images/mon_128.gif',
      aspectRatio: 1.1,
      blendMode: 'Cutout',
    },
  ],
  [
    'testCharacter_4_image',
    {
      url: 'https://udonarium.app/assets/images/mon_150.gif',
      aspectRatio: 1.3,
      blendMode: 'Cutout',
    },
  ],
  [
    'testCharacter_5_image',
    {
      url: 'https://udonarium.app/assets/images/mon_211.gif',
      aspectRatio: 1.2,
      blendMode: 'Cutout',
    },
  ],
  [
    'testCharacter_6_image',
    {
      url: 'https://udonarium.app/assets/images/mon_135.gif',
      aspectRatio: 1,
      blendMode: 'Cutout',
    },
  ],
  [
    'none_icon',
    {
      url: 'https://udonarium.app/assets/images/ic_account_circle_black_24dp_2x.png',
      aspectRatio: 1,
      blendMode: 'Alpha',
    },
  ],
] as const;

export const KNOWN_IMAGES: ReadonlyMap<string, KnownImageDefinition> = new Map(KNOWN_IMAGE_ENTRIES);

const KNOWN_EXTERNAL_IMAGE_METADATA: ReadonlyArray<KnownExternalImageMetadata> = [
  {
    path: 'assets/images/trump/',
    aspectRatio: 1.5,
    blendMode: 'Cutout',
  },
  ...KNOWN_IMAGE_ENTRIES.map(([, known]) => ({
    path: extractPathname(known.url),
    aspectRatio: known.aspectRatio,
    blendMode: known.blendMode,
  })),
];

const KNOWN_EXTERNAL_IMAGE_PREFIX_METADATA: ReadonlyArray<KnownExternalImagePrefixMetadata> = [
  {
    prefix: 'assets/images/trump/',
    aspectRatio: 1.5,
    blendMode: 'Cutout',
  },
  {
    prefix: 'assets/images/dice/',
    aspectRatio: 1,
    blendMode: 'Cutout',
  },
];

/**
 * Known aspect ratios for external URL/path based identifiers.
 * ratio = height / width
 */
export const KNOWN_EXTERNAL_IMAGE_ASPECT_RATIOS: ReadonlyMap<string, number> = toAspectRatioMap(
  KNOWN_EXTERNAL_IMAGE_METADATA.filter((entry) => !entry.path.endsWith('/')),
  (entry) => entry.path
);

/**
 * Known blend modes for external URL/path based identifiers.
 */
export const KNOWN_EXTERNAL_IMAGE_BLEND_MODES: ReadonlyMap<string, ImageBlendMode> = toBlendModeMap(
  KNOWN_EXTERNAL_IMAGE_METADATA.filter((entry) => !entry.path.endsWith('/')),
  (entry) => entry.path
);

/**
 * Prefix-based known aspect ratios for external URL/path based identifiers.
 * ratio = height / width
 */
export const KNOWN_EXTERNAL_IMAGE_ASPECT_RATIO_PREFIXES: ReadonlyArray<{
  prefix: string;
  ratio: number;
}> = KNOWN_EXTERNAL_IMAGE_PREFIX_METADATA.map((entry) => ({
  prefix: entry.prefix,
  ratio: entry.aspectRatio,
}));

/**
 * Prefix-based blend mode for external URL/path based identifiers.
 */
export const KNOWN_EXTERNAL_IMAGE_BLEND_MODE_PREFIXES: ReadonlyArray<{
  prefix: string;
  blendMode: ImageBlendMode;
}> = KNOWN_EXTERNAL_IMAGE_PREFIX_METADATA.map((entry) => ({
  prefix: entry.prefix,
  blendMode: entry.blendMode,
}));

/**
 * Supported object type tags in Udonarium XML
 */
export const SUPPORTED_TAGS = [
  'character',
  'dice-symbol',
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
  'dice-symbol': {
    meshType: 'Quad',
    description: 'Dice symbol token showing current face image',
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
