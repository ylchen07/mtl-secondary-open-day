export const MONTREAL_TZ = 'America/Toronto';

export const GREATER_MONTREAL_BBOX = {
  minLat: 45.3,
  maxLat: 45.75,
  minLng: -74.05,
  maxLng: -73.3,
} as const;

export const LOCALES = ['en', 'fr'] as const;
export const DEFAULT_LOCALE = 'en';

export type Locale = (typeof LOCALES)[number];

export const EVENT_TYPES = [
  'open_house',
  'info_session',
  'entrance_exam',
  'interview',
  'tour',
  'virtual',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
