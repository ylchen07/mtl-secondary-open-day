import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { validateSchoolFiles, type SchoolFile } from '../src/lib/schema';

/** Hosts that are directories of schools, not schools themselves. */
const AGGREGATOR_HOSTS = ['feep.qc.ca'];

function isAggregator(url: string): boolean {
  let host: string;
  try {
    // A fully-qualified `feep.qc.ca.` resolves identically but survives URL
    // parsing with its trailing dot, so strip it before comparing.
    host = new URL(url).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return false;
  }
  return AGGREGATOR_HOSTS.some((a) => host === a || host.endsWith(`.${a}`));
}

export function findAggregatorSources(schools: SchoolFile[]): string[] {
  const violations: string[] = [];

  for (const school of schools) {
    if (school.status === 'published' && isAggregator(school.source_url)) {
      violations.push(`${school.slug}: published school cites aggregator ${school.source_url}`);
    }
    for (const event of school.open_days) {
      if (event.status === 'published' && isAggregator(event.source_url)) {
        violations.push(
          `${school.slug} (${event.starts_at}): published event cites aggregator ${event.source_url}`,
        );
      }
    }
  }

  return violations;
}

async function main(): Promise<void> {
  const dir = path.join(process.cwd(), 'data', 'schools');
  const names = (await readdir(dir)).filter((n) => n.endsWith('.json'));

  const files = await Promise.all(
    names.map(async (name) => {
      const filePath = path.join(dir, name);
      const raw = await readFile(filePath, 'utf8');
      try {
        return { path: filePath, json: JSON.parse(raw) as unknown };
      } catch (cause) {
        throw new Error(`${filePath}: invalid JSON — ${(cause as Error).message}`);
      }
    }),
  );

  const { ok, errors } = validateSchoolFiles(files);
  if (errors.length > 0) {
    console.error(`\n${errors.length} validation error(s):\n`);
    for (const e of errors) console.error(`  ${e}`);
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

// Run only when executed directly, never when tests import findAggregatorSources.
// Compared by basename, not by full file URL: on macOS `import.meta.url` is the
// realpath while `process.argv[1]` is not, so a strict URL comparison silently
// fails to fire under a symlinked path — and a guard that silently exits 0 is
// worse than no guard.
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
