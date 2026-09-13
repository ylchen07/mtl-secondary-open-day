import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseListing } from '../src/lib/harvest/parse-listing';
import { parseDetail } from '../src/lib/harvest/parse-detail';
import { loadExistingSchools, runHarvest, todayInMontreal } from '../src/lib/harvest/orchestrate';

const LISTING_URL = 'https://www.feep.qc.ca/ecoles-privees-quebec/portes-ouvertes';
const UA = 'Mozilla/5.0 (compatible; mtl-open-day-harvest/1.0)';
const DATA_DIR = path.join(process.cwd(), 'data', 'schools');
const REPORT_PATH = path.join(process.cwd(), 'harvest-report.md');

// Be a polite guest on someone else's server: this is the minimum pause
// between any two detail-page requests, on every path (success, failure, or
// primary-only exclusion) — see runHarvest in src/lib/harvest/orchestrate.ts.
const REQUEST_DELAY_MS = 400;

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

async function main(): Promise<void> {
  const today = todayInMontreal(new Date());

  const existing = await loadExistingSchools(
    { readdir, readFile: (filePath) => readFile(filePath, 'utf8') },
    DATA_DIR,
  );
  console.log(`Loaded ${existing.length} existing school file(s).`);

  console.log('Fetching FEEP listing\u2026');
  const result = await runHarvest({
    fetchListing: () => get(LISTING_URL),
    fetchDetail: get,
    parseListing,
    parseDetail,
    existing,
    today,
    delay: () => new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS)),
    writeFile: (filePath, contents) => writeFile(filePath, contents, 'utf8'),
    dataDir: DATA_DIR,
  });

  await writeFile(REPORT_PATH, result.report, 'utf8');

  console.log(`\nWrote ${result.written.length} draft(s). See harvest-report.md.`);
  console.log('Drafts are invisible to the site until a human verifies them.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
