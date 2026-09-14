import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { findAggregatorSources } from '../src/lib/check-sources';
import { validateSchoolFiles } from '../src/lib/schema';

const DATA_DIR = join(process.cwd(), 'data', 'schools');

// Flat, `.json`-suffixed, non-recursive — the same shape `scripts/seed.ts` and
// `tests/data-integrity.test.ts` read. A guard that searched more widely than
// the seeder publishes would be checking a different data set than the one that
// ships. If the layout ever shards into subdirectories, the empty-set check in
// main() turns that into a loud failure instead of a silent pass.
async function loadFiles() {
  const names = (await readdir(DATA_DIR)).filter((n) => n.endsWith('.json'));

  return Promise.all(
    names.map(async (name) => {
      const path = join(DATA_DIR, name);
      const raw = await readFile(path, 'utf8');
      try {
        return { path, json: JSON.parse(raw) as unknown };
      } catch (cause) {
        throw new Error(`${path}: invalid JSON — ${(cause as Error).message}`);
      }
    }),
  );
}

async function main() {
  const { ok, errors } = validateSchoolFiles(await loadFiles());

  if (errors.length > 0) {
    console.error(`\n${errors.length} validation error(s):\n`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }

  // Fail closed. A guard that checked nothing must never report success.
  if (ok.length === 0) {
    console.error(`\ncheck:sources found no school files under ${DATA_DIR} — refusing to pass.\n`);
    process.exit(1);
  }

  const violations = findAggregatorSources(ok);
  if (violations.length > 0) {
    console.error(
      '\nPublished rows may not cite an aggregator as their source.\n' +
        "FEEP is a lead, not a source. Verify against the school's own page.\n",
    );
    for (const v of violations) console.error(`  ${v}`);
    console.error('');
    process.exit(1);
  }

  console.log(`check:sources — ${ok.length} school file(s) clean.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
