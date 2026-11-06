import { MONTREAL_TZ } from './constants';
import { schoolFileSchema, type SchoolFile } from './schema';

/**
 * The Montreal calendar date for a given instant, as `YYYY-MM-DD`.
 *
 * `new Date().toISOString().slice(0, 10)` is wrong for roughly five hours of
 * every day: UTC has already rolled over to the next calendar date while
 * Montreal (UTC-4/-5) has not, so `last_verified_at` would be stamped a day
 * ahead of the review.
 */
export function todayInMontreal(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MONTREAL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

type FileSystemDeps = {
  readdir: (dir: string) => Promise<string[]>;
  readFile: (path: string) => Promise<string>;
};

/**
 * Every school file, failing closed on the first one that is not valid JSON
 * or not schema-valid: a script that rewrites school files must never run
 * against a set it could only partly read.
 */
export async function loadSchoolFiles(deps: FileSystemDeps, dataDir = 'data/schools'): Promise<SchoolFile[]> {
  const names = (await deps.readdir(dataDir)).filter((n) => n.endsWith('.json'));
  const out: SchoolFile[] = [];

  for (const name of names) {
    const path = `${dataDir}/${name}`;
    let raw: string;
    try {
      raw = await deps.readFile(path);
    } catch (cause) {
      throw new Error(`${path}: could not read — ${(cause as Error).message}`);
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (cause) {
      throw new Error(`${path}: invalid JSON — ${(cause as Error).message}`);
    }

    const parsed = schoolFileSchema.safeParse(json);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'} — ${i.message}`).join('; ');
      throw new Error(`${path}: schema-invalid — ${issues}`);
    }

    out.push(parsed.data);
  }

  return out;
}

/** The key order a reviewer expects in a diff, the same on every write. */
const KEY_ORDER: (keyof SchoolFile)[] = [
  'slug', 'name_en', 'name_fr', 'language', 'gender', 'sector', 'region', 'city',
  'address', 'postal_code', 'location', 'geocode_precision', 'website_url',
  'admissions_url', 'tuition_annual_cad', 'has_boarding', 'programs',
  'description_en', 'description_fr', 'description_source_url', 'wikipedia_url', 'source_url', 'last_verified_at', 'open_days',
];

/** Serialise a `SchoolFile` with a stable key order and a trailing newline. */
export function serialise(school: SchoolFile): string {
  const ordered: Record<string, unknown> = {};
  for (const key of KEY_ORDER) ordered[key] = school[key];
  return `${JSON.stringify(ordered, null, 2)}\n`;
}
