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
    host: 'ResoniteLink Host',
    port: 'Port:',
    resoniteLinkPort: 'ResoniteLink Port',
    portHelpAriaLabel: 'ResoniteLink port help',
    portHelpTooltip: 'Click to view how to configure ResoniteLink',
    portHelpTitle: 'How to configure ResoniteLink',
    portHelpStep1: 'Open a world where you are the host',
    portHelpStep2: 'In the Session tab, enable "ResoniteLink"',
    portHelpStep3: 'Enter the ResoniteLink port number',
    dropZipOnly: 'Please drop a ZIP file',
    rootGrabbable: 'Add Grabbable to root',
    simpleAvatarProtection: 'Add SimpleAvatarProtection',
    rootScale: 'Root Scale',
    lockedTerrainCharacterCollider: 'Enable collider on table and locked terrain',
    semiTransparentImageBlendMode: 'Blend mode for semi-transparent images',
    blendModeCutout: 'Cutout',
    blendModeAlpha: 'Alpha',
    settingsHint: 'Start Resonite and enable ResoniteLink.',
    mainControlsTitle: 'Import Settings',
    advancedOptions: 'Advanced Options',
    advancedOptionsTitle: 'Advanced Options',
    showDetails: 'Show details',
    importLogTitle: 'Import Log',
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
    ensureSupportedObjects: 'Use a ZIP file that contains supported Udonarium objects.',
    extracting: 'Extracting ZIP file...',
    parsingObjects: 'Parsing objects...',
    connectingResonite: 'Connecting to ResoniteLink...',
    importingData: 'Importing...',
    importingImages: 'Importing images... {current}/{total}',
    creatingObjects: 'Creating objects... {current}/{total}',
    complete: 'Complete',
    language: 'Language',
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

// Japanese translations
const jaTranslations: Translations = {
  gui: {
    title: 'Udonarium Resonite Importer',
    subtitle: 'UdonariumのセーブデータをResoniteにインポート',
    selectFile: 'ZIPファイルを選択',
    selectFilePlaceholder: 'ファイルを選択してください...',
    browse: '選択',
    analysisResult: '解析結果',
    xmlFiles: 'XMLファイル',
    imageFiles: '画像ファイル',
    objects: 'オブジェクト',
    settings: 'ResoniteLink設定',
    host: 'ResoniteLinkホスト',
    port: 'ポート:',
    resoniteLinkPort: 'ResoniteLinkポート',
    portHelpAriaLabel: 'ResoniteLinkポートのヘルプ',
    portHelpTooltip: 'ResoniteLinkの設定方法を表示',
    portHelpTitle: 'ResoniteLinkの設定方法',
    portHelpStep1: '自分がホストのワールドを開く',
    portHelpStep2: 'セッションタブで「ResoniteLinkを有効化」',
    portHelpStep3: 'ResoniteLinkのポート番号を入力',
    dropZipOnly: 'ZIPファイルをドロップしてください',
    rootGrabbable: 'ルートにGrabbableを付ける',
    simpleAvatarProtection: 'SimpleAvatarProtectionを付ける',
    rootScale: 'ルートスケール',
    lockedTerrainCharacterCollider: 'テーブルと固定した地形にコライダーを付ける',
    semiTransparentImageBlendMode: '半透明画像の描画方式',
    blendModeCutout: 'Cutout',
    blendModeAlpha: 'Alpha',
    settingsHint: 'Resoniteを起動し、ResoniteLinkを有効にしてください。',
    mainControlsTitle: 'インポート設定',
    advancedOptions: '高度なオプション',
    advancedOptionsTitle: '高度なオプション',
    showDetails: '詳細を表示',
    importLogTitle: 'インポート実行ログ',
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
    ensureSupportedObjects: '対応オブジェクトを含むUdonariumのZIPファイルを指定してください。',
    extracting: 'ZIPファイルを展開中...',
    parsingObjects: 'オブジェクトを解析中...',
    connectingResonite: 'ResoniteLinkに接続中...',
    importingData: 'インポート中...',
    importingImages: '画像をインポート中... {current}/{total}',
    creatingObjects: 'オブジェクトを作成中... {current}/{total}',
    complete: '完了',
    language: '言語',
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

// Auto-initialize
initI18n();
