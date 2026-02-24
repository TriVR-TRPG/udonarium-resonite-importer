/**
 * Internationalization (i18n) module
 * Simple JSON-based translation system
 */

import * as fs from 'fs';
import * as path from 'path';
import enTranslations from './locales/en.json';
import jaTranslations from './locales/ja.json';

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

// Auto-initialize translations on module load
initI18n();
