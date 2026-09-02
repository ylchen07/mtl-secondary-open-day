import { config } from 'dotenv';
config({ path: '.env.local' });

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateSchoolFiles } from '../src/lib/schema';
import { toOpenDayRows, toSchoolRow } from '../src/lib/seed-mapping';
import { createWriteClient } from '../src/lib/supabase';

const DATA_DIR = join(process.cwd(), 'data', 'schools');

function loadFiles() {
  return readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const path = join(DATA_DIR, f);
      try {
        return { path, json: JSON.parse(readFileSync(path, 'utf8')) as unknown };
      } catch (cause) {
        throw new Error(`${path}: invalid JSON — ${(cause as Error).message}`);
      }
    });
}

async function main() {
  // 1. PARSE + 2. VALIDATE
  const files = loadFiles();
  const { ok, errors } = validateSchoolFiles(files);

  // 3. REPORT — every error at once, before touching the database
  if (errors.length > 0) {
    console.error(`\n${errors.length} validation error(s):\n`);
    for (const e of errors) console.error(`  ${e}`);
    console.error('\nNothing was written to the database.\n');
    process.exit(1);
  }

  console.log(`Validated ${ok.length} school file(s).`);

  // 4. UPSERT
  const supabase = createWriteClient();

  const { data: schools, error: schoolError } = await supabase
    .from('schools')
    .upsert(ok.map(toSchoolRow), { onConflict: 'slug' })
    .select('id, slug');

  if (schoolError) throw new Error(`School upsert failed: ${schoolError.message}`);

  const idBySlug = new Map(schools!.map((s) => [s.slug as string, s.id as string]));

  const eventRows = ok.flatMap((file) =>
    toOpenDayRows(file, idBySlug.get(file.slug)!),
  );

  if (eventRows.length > 0) {
    const { error: eventError } = await supabase
      .from('open_days')
      .upsert(eventRows, { onConflict: 'school_id,starts_at,type' });
    if (eventError) throw new Error(`Event upsert failed: ${eventError.message}`);
  }

  // Archive schools that no longer have a file, rather than deleting them,
  // so bookmarked URLs never 404. Guarded: an empty slug list would build
  // the invalid PostgREST filter `in.()` and archive nothing while erroring.
  const liveSlugs = ok.map((s) => s.slug);
  if (liveSlugs.length > 0) {
    const { error: archiveError } = await supabase
      .from('schools')
      .update({ status: 'archived' })
      .not('slug', 'in', `(${liveSlugs.map((s) => `"${s}"`).join(',')})`);

    if (archiveError) throw new Error(`Archiving failed: ${archiveError.message}`);
  }

  console.log(`Upserted ${ok.length} school(s) and ${eventRows.length} event(s).`);

  // Tell Vercel to rebuild the affected pages now rather than in up to an hour
  const hook = process.env.REVALIDATE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (hook && secret) {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret }),
    });
    console.log(res.ok ? 'Revalidation triggered.' : `Revalidation failed: ${res.status}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
