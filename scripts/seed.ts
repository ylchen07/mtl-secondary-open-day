import { config } from 'dotenv';
config({ path: '.env.local' });

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildSlugBySchoolId,
  computeStaleOpenDayIds,
  resolveRemoteOpenDayIdentities,
  type LocalOpenDayIdentity,
} from '../src/lib/open-day-sync';
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

  // Supabase is a rebuildable projection of git: remove `open_days` rows that
  // no longer correspond to a desired event now that the desired rows above
  // are safely upserted. Read every current school (not just the ones just
  // upserted) so an event belonging to a school whose file was deleted
  // entirely is still resolvable — that school isn't archived until the
  // step below. Deletes target exact remote ids only; nothing is deleted
  // before the desired upserts above have succeeded, and any failure here
  // throws before archiving or revalidation run.
  const { data: allSchools, error: allSchoolsError } = await supabase
    .from('schools')
    .select('id, slug');
  if (allSchoolsError) {
    throw new Error(`School read for event sync failed: ${allSchoolsError.message}`);
  }

  const slugBySchoolId = buildSlugBySchoolId(allSchools ?? []);

  const { data: remoteEventRows, error: remoteEventsError } = await supabase
    .from('open_days')
    .select('id, school_id, starts_at, type');
  if (remoteEventsError) {
    throw new Error(`Event read for sync failed: ${remoteEventsError.message}`);
  }

  const remoteIdentities = resolveRemoteOpenDayIdentities(remoteEventRows ?? [], slugBySchoolId);
  const desiredIdentities: LocalOpenDayIdentity[] = ok.flatMap((file) =>
    file.open_days.map((event) => ({
      schoolSlug: file.slug,
      startsAt: event.starts_at,
      type: event.type,
    })),
  );
  const staleEventIds = computeStaleOpenDayIds(remoteIdentities, desiredIdentities);

  if (staleEventIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('open_days')
      .delete()
      .in('id', staleEventIds);
    if (deleteError) throw new Error(`Stale event delete failed: ${deleteError.message}`);
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

  console.log(
    `Upserted ${ok.length} school(s) and ${eventRows.length} event(s); removed ${staleEventIds.length} stale event row(s).`,
  );

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
