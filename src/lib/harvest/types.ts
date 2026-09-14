import type { SchoolFile } from '../schema';

export type Region = SchoolFile['region'];

export type ListingEvent = {
  /** ISO date `YYYY-MM-DD`, or null when the entry has no parseable date. */
  date: string | null;
  /** 24-hour `HH:mm`, or null when no time range was published. */
  startTime: string | null;
  endTime: string | null;
  /** The original text, kept so a human can see what we refused to parse. */
  rawDate: string;
  noteFr: string | null;
};

export type ListingEntry = {
  feepSlug: string;
  nameFr: string;
  region: Region | null;
  /** The school's own site, from the "En savoir plus" link. */
  externalUrl: string | null;
  events: ListingEvent[];
};

export type SchoolFacts = {
  address: string | null;
  city: string | null;
  postalCode: string | null;
  language: SchoolFile['language'] | null;
  /** True only when the detail page's Education Level mentions secondary. */
  isSecondary: boolean;
  /** Inferred from prose; always treated as unconfirmed. */
  genderGuess: SchoolFile['gender'];
  genderConfident: boolean;
};
