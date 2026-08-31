import { z } from 'zod';
import { GREATER_MONTREAL_BBOX } from './constants';

const httpsUrl = z
  .string()
  .url()
  .refine((u) => u.startsWith('https://'), { message: 'must use https' });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

const nonEmpty = z.string().trim().min(1);

const publicationStatus = z.enum(['published', 'draft', 'archived']);

const academicYear = z
  .string()
  .regex(/^\d{4}-\d{4}$/, 'must be YYYY-YYYY')
  .refine((v) => {
    const [a, b] = v.split('-').map(Number);
    return b === a + 1;
  }, { message: 'academic year must span consecutive years' });

const EIGHTEEN_MONTHS_MS = 1000 * 60 * 60 * 24 * 550;

const openDaySchema = z
  .object({
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }),
    type: z.enum(['open_house', 'info_session', 'entrance_exam', 'tour', 'virtual']),
    academic_year: academicYear,
    registration_required: z.boolean(),
    registration_url: httpsUrl.nullish(),
    notes_en: z.string().nullish(),
    notes_fr: z.string().nullish(),
    source_url: httpsUrl,
    last_verified_at: isoDate,
    status: publicationStatus,
  })
  .refine((e) => new Date(e.starts_at) < new Date(e.ends_at), {
    message: 'starts_at must be before ends_at',
    path: ['ends_at'],
  })
  .refine(
    (e) => new Date(e.starts_at).getTime() - Date.now() < EIGHTEEN_MONTHS_MS,
    { message: 'event is more than 18 months out — likely a year typo', path: ['starts_at'] },
  );

export const schoolFileSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be kebab-case'),
    name_en: nonEmpty,
    name_fr: nonEmpty,
    language: z.enum(['fr', 'en', 'bilingual']),
    gender: z.enum(['mixed', 'girls', 'boys']),
    region: z.enum([
      'montreal_island',
      'west_island',
      'laval',
      'north_shore',
      'south_shore',
    ]),
    city: nonEmpty,
    address: nonEmpty,
    postal_code: nonEmpty,
    location: z
      .object({
        lat: z.number().min(GREATER_MONTREAL_BBOX.minLat).max(GREATER_MONTREAL_BBOX.maxLat),
        lng: z.number().min(GREATER_MONTREAL_BBOX.minLng).max(GREATER_MONTREAL_BBOX.maxLng),
      })
      .nullish(),
    geocode_precision: z.enum(['exact', 'approximate', 'missing']),
    website_url: httpsUrl,
    admissions_url: httpsUrl,
    tuition_annual_cad: z.number().int().positive().nullish(),
    has_boarding: z.boolean(),
    programs: z.array(z.string()),
    description_en: nonEmpty,
    description_fr: nonEmpty,
    source_url: httpsUrl,
    last_verified_at: isoDate,
    status: publicationStatus,
    open_days: z.array(openDaySchema),
  })
  .refine((s) => (s.geocode_precision === 'missing') === (s.location == null), {
    message: 'location must be present unless geocode_precision is "missing"',
    path: ['location'],
  });

export type SchoolFile = z.infer<typeof schoolFileSchema>;
export type OpenDayInput = SchoolFile['open_days'][number];

export function validateSchoolFiles(
  files: { path: string; json: unknown }[],
): { ok: SchoolFile[]; errors: string[] } {
  const ok: SchoolFile[] = [];
  const errors: string[] = [];
  const seenSlugs = new Map<string, string>();

  for (const file of files) {
    const parsed = schoolFileSchema.safeParse(file.json);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const where = issue.path.join('.') || '(root)';
        errors.push(`${file.path}: ${where} — ${issue.message}`);
      }
      continue;
    }

    const school = parsed.data;
    const expectedFilename = `${school.slug}.json`;

    if (!file.path.endsWith(`/${expectedFilename}`)) {
      errors.push(
        `${file.path}: slug "${school.slug}" does not match filename (expected ${expectedFilename})`,
      );
    }

    const previous = seenSlugs.get(school.slug);
    if (previous) {
      errors.push(`${file.path}: duplicate slug "${school.slug}" (also in ${previous})`);
    } else {
      seenSlugs.set(school.slug, file.path);
    }

    ok.push(school);
  }

  return { ok, errors };
}
