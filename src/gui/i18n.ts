/**
 * i18n module for GUI (renderer process)
 * Browser-compatible version with embedded translations
 */

export type Locale = 'en' | 'ja';

type TranslationValue = string | Record<string, unknown>;
type Translations = Record<string, TranslationValue>;

let currentLocale: Locale = 'en';
let translations: Translations = {};

/**
 * Detect browser/system locale
 */
export function detectLocale(): Locale {
  const lang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || 'en';
  if (lang.toLowerCase().startsWith('ja')) {
    return 'ja';
  }
  return 'en';
}

/**
 * Load translations for a locale
 */
export function loadLocale(locale: Locale): void {
  currentLocale = locale;
  translations = locale === 'ja' ? jaTranslations : enTranslations;
}

/**
 * Get translated string
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value: unknown = translations;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return key;
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

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
 * Initialize i18n
 */
export function initI18n(locale?: Locale): void {
  const targetLocale = locale ?? detectLocale();
  loadLocale(targetLocale);
}

// English translations
const enTranslations: Translations = {
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
    card: 'Card',
    'card-stack': 'Card Stack',
    terrain: 'Terrain',
    table: 'Table',
    'table-mask': 'Table Mask',
    'text-note': 'Text Note',
  },
};

// Japanese translations
const jaTranslations: Translations = {
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
    card: 'カード',
    'card-stack': 'カードの山',
    terrain: '地形',
    table: 'テーブル',
    'table-mask': 'テーブルマスク',
    'text-note': 'テキストノート',
  },
};

// Auto-initialize
initI18n();
