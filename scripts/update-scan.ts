import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadExistingSchools, todayInMontreal } from '../src/lib/harvest/orchestrate';
import { renderQueue, renderSummary, runScan, type FetchResult } from '../src/lib/watch/scan';

const UA = 'Mozilla/5.0 (compatible; mtl-open-day-watch/1.0)';
const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data', 'schools');
const WATCH_DIR = path.join(ROOT, 'data', 'watch');
const PENDING_DIR = path.join(ROOT, 'work', 'pending');
const QUEUE_PATH = path.join(ROOT, 'work', 'queue.md');

// Same courtesy as `pnpm harvest`: a pause between any two requests.
const REQUEST_DELAY_MS = 400;
const TIMEOUT_MS = 20_000;

const RETRY_AFTER_MS = 5_000;

async function fetchOnce(url: string): Promise<FetchResult & { retryable?: boolean }> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false, reason: `HTTP ${res.status}`, retryable: res.status === 429 || res.status >= 500 };
    }
    return { ok: true, html: await res.text() };
  } catch (cause) {
    return { ok: false, reason: cause instanceof Error ? cause.message : String(cause), retryable: true };
  }
}

/** One patient retry for rate limits and server errors; a 403/404 will not improve by waiting. */
async function fetchPage(url: string): Promise<FetchResult> {
  const first = await fetchOnce(url);
  if (first.ok || !first.retryable) return first;
  await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS));
  return fetchOnce(url);
}

async function readOrNull(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8');
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw cause;
  }
}

async function main(): Promise<void> {
  const today = todayInMontreal(new Date());
  await mkdir(WATCH_DIR, { recursive: true });
  await mkdir(PENDING_DIR, { recursive: true });

  const schools = await loadExistingSchools(
    { readdir, readFile: (p) => readFile(p, 'utf8') },
    DATA_DIR,
  );
  console.log(`Watching ${schools.length} school page(s)\u2026`);

  const result = await runScan(schools, {
    fetchPage,
    readSnapshot: (slug) => readOrNull(path.join(WATCH_DIR, `${slug}.txt`)),
    writeBaseline: (slug, text) => writeFile(path.join(WATCH_DIR, `${slug}.txt`), text, 'utf8'),
    writePending: (slug, text) => writeFile(path.join(PENDING_DIR, `${slug}.txt`), text, 'utf8'),
    clearPending: (slug) => rm(path.join(PENDING_DIR, `${slug}.txt`), { force: true }),
    delay: () => new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS)),
  });

  await writeFile(QUEUE_PATH, renderQueue(result, schools, today), 'utf8');
  console.log(renderSummary(result));
  console.log('\nQueue written to work/queue.md');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
