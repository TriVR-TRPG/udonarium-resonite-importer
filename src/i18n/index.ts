/**
 * Internationalization (i18n) module
 * Simple JSON-based translation system
 */

import * as fs from 'fs';
import * as path from 'path';

export type Locale = 'en' | 'ja';

type TranslationValue = string | Record<string, unknown>;
type Translations = Record<string, TranslationValue>;

let currentLocale: Locale = 'en';
let translations: Translations = {};

/**
 * Detect system locale
 */
export function detectLocale(): Locale {
  const env = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || '';
  if (env.toLowerCase().startsWith('ja')) {
    return 'ja';
  }
  return 'en';
}

/**
 * Load translations for a locale
 */
export function loadLocale(locale: Locale): void {
  currentLocale = locale;

  // Try to load from file
  const localePath = path.join(__dirname, 'locales', `${locale}.json`);

  try {
    if (fs.existsSync(localePath)) {
      const content = fs.readFileSync(localePath, 'utf-8');
      translations = JSON.parse(content) as Translations;
    } else {
      // Fallback to embedded translations
      translations = getEmbeddedTranslations(locale);
    }
  } catch {
    translations = getEmbeddedTranslations(locale);
  }
}

/**
 * Get embedded translations (fallback when file not found)
 */
function getEmbeddedTranslations(locale: Locale): Translations {
  if (locale === 'ja') {
    return jaTranslations;
  }
  return enTranslations;
}

/**
 * Get translated string
 * Supports nested keys like 'cli.extracting'
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value: unknown = translations;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      // Key not found, return the key itself
      return key;
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

  // Replace parameters like {name} with actual values
  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, paramKey: string) => {
      return params[paramKey]?.toString() ?? `{${paramKey}}`;
    });
  }

  return value;
}

/**
 * Get current locale
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Set locale
 */
export function setLocale(locale: Locale): void {
  loadLocale(locale);
}

/**
 * Initialize i18n with auto-detected or specified locale
 */
export function initI18n(locale?: Locale): void {
  const targetLocale = locale ?? detectLocale();
  loadLocale(targetLocale);
}

// Embedded translations for fallback
const enTranslations: Translations = {
  app: {
    title: 'Udonarium Resonite Importer',
    version: 'v{version}',
  },
  cli: {
    description: 'Import Udonarium save data into Resonite via ResoniteLink',
    extracting: 'Extracting ZIP file...',
    extracted: 'ZIP extracted - XML: {xml}, Images: {images}',
    parsing: 'Parsing objects...',
    parsed: 'Parsed {count} objects',
    connecting: 'Connecting to ResoniteLink ({host}:{port})...',
    connected: 'Connected to ResoniteLink',
    importing: 'Importing to Resonite...',
    importingImages: 'Importing images... {current}/{total}',
    importingObjects: 'Creating objects... {current}/{total}',
    importComplete: 'Import complete - Images: {images}, Objects: {objects}',
    success: 'Import completed successfully!',
    checkResonite: 'Check Resonite to see the imported objects.',
    dryRunMode: 'Dry run mode - not connecting to Resonite',
    summary: 'Summary:',
    objectsToImport: 'Objects to import: {count}',
    imagesToImport: 'Images to import: {count}',
    help: {
      version: 'Display version number',
      input: 'Input ZIP file path',
      port: 'ResoniteLink port (required, or set RESONITELINK_PORT env var)',
      host: 'ResoniteLink host (default: localhost, or set RESONITELINK_HOST env var)',
      scale: 'Scale factor',
      enableCharacterColliderOnLockedTerrain:
        'Enable CharacterCollider on locked Terrain and table visual collider',
      dryRun: 'Analyze only, do not connect to Resonite',
      verbose: 'Verbose output',
      lang: 'Language (en, ja)',
      help: 'Display help for command',
    },
    error: {
      fileNotFound: 'Error: File not found: {path}',
      extractFailed: 'Failed to extract ZIP',
      connectFailed: 'Failed to connect to ResoniteLink',
      importFailed: 'Import failed',
      ensureResonite: 'Make sure Resonite is running with ResoniteLink enabled.',
    },
  },
  gui: {
    title: 'Udonarium Resonite Importer',
    subtitle: 'Import Udonarium save data into Resonite',
    selectFile: 'Select ZIP File',
    selectFilePlaceholder: 'Select a file...',
    browse: 'Browse...',
    analysisResult: 'Analysis Result',
    xmlFiles: 'XML Files',
    imageFiles: 'Image Files',
    objects: 'Objects',
    settings: 'ResoniteLink Settings',
    host: 'Host:',
    port: 'Port:',
    settingsHint: 'Start Resonite and enable ResoniteLink.',
    import: 'Import',
    importToResonite: 'Import to Resonite',
    preparing: 'Preparing...',
    importComplete: 'Import Complete!',
    images: 'Images: {imported}/{total}',
    objectsResult: 'Objects: {imported}/{total}',
    checkResonite: 'Check Resonite to see the imported objects.',
    error: 'Error',
    errorOccurred: 'An error occurred',
    ensureResonite: 'Make sure Resonite is running.',
    extracting: 'Extracting ZIP file...',
    parsingObjects: 'Parsing objects...',
    connectingResonite: 'Connecting to ResoniteLink...',
    importingData: 'Importing...',
    importingImages: 'Importing images... {current}/{total}',
    creatingObjects: 'Creating objects... {current}/{total}',
    complete: 'Complete',
  },
  objectTypes: {
    character: 'Character',
    'dice-symbol': 'Dice Symbol',
    card: 'Card',
    'card-stack': 'Card Stack',
    terrain: 'Terrain',
    table: 'Table',
    'table-mask': 'Table Mask',
    'text-note': 'Text Note',
  },
};

const jaTranslations: Translations = {
  app: {
    title: 'Udonarium Resonite Importer',
    version: 'v{version}',
  },
  cli: {
    description: 'UdonariumのセーブデータをResoniteLink経由でResoniteにインポート',
    extracting: 'ZIPファイルを解凍中...',
    extracted: 'ZIP解凍完了 - XML: {xml}, 画像: {images}',
    parsing: 'オブジェクトを解析中...',
    parsed: '{count}個のオブジェクトを解析',
    connecting: 'ResoniteLinkに接続中 ({host}:{port})...',
    connected: 'ResoniteLinkに接続しました',
    importing: 'Resoniteにインポート中...',
    importingImages: '画像をインポート中... {current}/{total}',
    importingObjects: 'オブジェクトを作成中... {current}/{total}',
    importComplete: 'インポート完了 - 画像: {images}, オブジェクト: {objects}',
    success: 'インポートが完了しました！',
    checkResonite: 'Resoniteでインポートしたオブジェクトを確認してください。',
    dryRunMode: 'ドライランモード - Resoniteに接続しません',
    summary: '概要:',
    objectsToImport: 'インポート対象オブジェクト: {count}',
    imagesToImport: 'インポート対象画像: {count}',
    help: {
      version: 'バージョン番号を表示',
      input: '入力ZIPファイルのパス',
      port: 'ResoniteLinkのポート（必須。RESONITELINK_PORT環境変数でも指定可）',
      host: 'ResoniteLinkのホスト（既定: localhost。RESONITELINK_HOST環境変数でも指定可）',
      scale: 'スケール係数',
      enableCharacterColliderOnLockedTerrain:
        'ロックされたTerrainとテーブルの当たり判定にCharacterColliderを有効化',
      dryRun: '解析のみ実行し、Resoniteには接続しない',
      verbose: '詳細ログを表示',
      lang: '言語 (en, ja)',
      help: 'コマンドのヘルプを表示',
    },
    error: {
      fileNotFound: 'エラー: ファイルが見つかりません: {path}',
      extractFailed: 'ZIP解凍に失敗しました',
      connectFailed: 'ResoniteLinkへの接続に失敗しました',
      importFailed: 'インポートに失敗しました',
      ensureResonite: 'ResoniteLinkを有効にしてResoniteが起動しているか確認してください。',
    },
  },
  gui: {
    title: 'Udonarium Resonite Importer',
    subtitle: 'UdonariumのセーブデータをResoniteにインポート',
    selectFile: 'ZIPファイルを選択',
    selectFilePlaceholder: 'ファイルを選択してください...',
    browse: '参照...',
    analysisResult: '解析結果',
    xmlFiles: 'XMLファイル',
    imageFiles: '画像ファイル',
    objects: 'オブジェクト',
    settings: 'ResoniteLink設定',
    host: 'ホスト:',
    port: 'ポート:',
    settingsHint: 'Resoniteを起動し、ResoniteLinkを有効にしてください。',
    import: 'インポート',
    importToResonite: 'Resoniteにインポート',
    preparing: '準備中...',
    importComplete: 'インポート完了！',
    images: '画像: {imported}/{total}',
    objectsResult: 'オブジェクト: {imported}/{total}',
    checkResonite: 'Resoniteで確認してください',
    error: 'エラー',
    errorOccurred: 'エラーが発生しました',
    ensureResonite: 'Resoniteが起動しているか確認してください。',
    extracting: 'ZIPファイルを解凍中...',
    parsingObjects: 'オブジェクトを解析中...',
    connectingResonite: 'ResoniteLinkに接続中...',
    importingData: 'インポート中...',
    importingImages: '画像をインポート中... {current}/{total}',
    creatingObjects: 'オブジェクトを作成中... {current}/{total}',
    complete: '完了',
  },
  objectTypes: {
    character: 'キャラクター',
    'dice-symbol': 'ダイス',
    card: 'カード',
    'card-stack': 'カードの山札',
    terrain: '地形',
    table: 'テーブル',
    'table-mask': 'マップマスク',
    'text-note': '共有メモ',
  },
};

// Auto-initialize on import
initI18n();
