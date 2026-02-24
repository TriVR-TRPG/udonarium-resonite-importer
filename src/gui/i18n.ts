/**
 * i18n module for GUI (renderer process)
 * Browser-compatible version with embedded translations
 */

import enTranslations from '../i18n/locales/en.json';
import jaTranslations from '../i18n/locales/ja.json';

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

// Auto-initialize
initI18n();
