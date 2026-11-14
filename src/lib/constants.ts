export const MONTREAL_TZ = 'America/Toronto';

export const GREATER_MONTREAL_BBOX = {
  minLat: 45.3,
  maxLat: 45.75,
  minLng: -74.05,
  maxLng: -73.3,
} as const;

export const LOCALES = ['en', 'fr', 'zh'] as const;
export const DEFAULT_LOCALE = 'en';

export type Locale = (typeof LOCALES)[number];

/** BCP 47 tag for `<html lang>` and `Intl`; `zh` is Simplified Chinese. */
export const LOCALE_TAGS: Record<Locale, string> = { en: 'en-CA', fr: 'fr-CA', zh: 'zh-Hans-CA' };

/** Each language named in itself, for the language switch. */
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', fr: 'Français', zh: '简体中文' };

/**
 * School records carry English and French text only; any other locale shows
 * the English, marked so screen readers and fonts treat it as English.
 */
export const recordLang = (locale: Locale): 'en' | undefined => (locale === 'zh' ? 'en' : undefined);

export const EVENT_TYPES = [
  'open_house',
  'info_session',
  'entrance_exam',
  'interview',
  'tour',
  'virtual',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
