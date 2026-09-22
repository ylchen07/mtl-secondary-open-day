import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateSchoolFiles } from '@/lib/schema';

const DATA_DIR = join(process.cwd(), 'data', 'schools');
const AUDIT_PATH = join(
  process.cwd(),
  'docs',
  'data-audits',
  '2026-09-15-nullable-evidence-audit.md',
);

const ALLOWED_DISPOSITIONS = new Set([
  'supported',
  'unsupported-negative',
  'unsupported-positive',
  'contradicted',
]);

type AuditDisposition = 'supported' | 'unsupported-negative' | 'unsupported-positive' | 'contradicted';

type SchoolAuditRow = {
  file: string;
  field: 'has_boarding';
  identity: '—';
  before: 'true' | 'false' | 'null';
  after: 'true' | 'false' | 'null';
  disposition: AuditDisposition;
};

type EventAuditRow = {
  file: string;
  field: 'registration_required';
  identity: string;
  before: 'true' | 'false' | 'null';
  after: 'true' | 'false' | 'null';
  disposition: AuditDisposition;
};

function asBooleanLiteral(value: boolean | null): 'true' | 'false' | 'null' {
  if (value === null) return 'null';
  return value ? 'true' : 'false';
}

function stripTicks(value: string): string {
  return value.trim().replace(/^`/, '').replace(/`$/, '');
}

function parseAuditRows(): { schoolRows: SchoolAuditRow[]; eventRows: EventAuditRow[] } {
  const lines = readFileSync(AUDIT_PATH, 'utf8').split('\n');
  const schoolRows: SchoolAuditRow[] = [];
  const eventRows: EventAuditRow[] = [];

  let section: 'none' | 'school' | 'event' = 'none';

  for (const line of lines) {
    if (line.startsWith('## School field audit rows')) {
      section = 'school';
      continue;
    }

    if (line.startsWith('## Event field audit rows')) {
      section = 'event';
      continue;
    }

    if (line.startsWith('## ')) {
      section = 'none';
      continue;
    }

    if (!line.startsWith('|')) continue;
    if (line.startsWith('|---')) continue;
    if (line.startsWith('| File |')) continue;
    if (section === 'none') continue;

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

    expect(cells).toHaveLength(8);

    const [file, field, identity, before, after, disposition] = cells.map(stripTicks);

    expect(ALLOWED_DISPOSITIONS.has(disposition)).toBe(true);
    expect(['true', 'false', 'null']).toContain(before);
    expect(['true', 'false', 'null']).toContain(after);

    if (section === 'school') {
      schoolRows.push({
        file,
        field: field as SchoolAuditRow['field'],
        identity: identity as SchoolAuditRow['identity'],
        before: before as SchoolAuditRow['before'],
        after: after as SchoolAuditRow['after'],
        disposition: disposition as SchoolAuditRow['disposition'],
      });
      continue;
    }

    eventRows.push({
      file,
      field: field as EventAuditRow['field'],
      identity,
      before: before as EventAuditRow['before'],
      after: after as EventAuditRow['after'],
      disposition: disposition as EventAuditRow['disposition'],
    });
  }

  return { schoolRows, eventRows };
}

function loadAll() {
  return readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const path = join(DATA_DIR, f);
      return { path, json: JSON.parse(readFileSync(path, 'utf8')) as unknown };
    });
}

describe('data/schools', () => {
  it('contains at least one school', () => {
    expect(loadAll().length).toBeGreaterThan(0);
  });

  it('every file passes validation', () => {
    const { errors } = validateSchoolFiles(loadAll());
    expect(errors).toEqual([]);
  });

  it('every published school has at least one event', () => {
    const { ok } = validateSchoolFiles(loadAll());
    const barren = ok
      .filter((s) => s.status === 'published' && s.open_days.length === 0)
      .map((s) => s.slug);
    expect(barren).toEqual([]);
  });

  it('has the reviewed publication counts and no published event under a draft school', () => {
    const { ok } = validateSchoolFiles(loadAll());
    const publishedSchools = ok.filter((school) => school.status === 'published');
    const publishedEvents = ok.flatMap((school) =>
      school.open_days
        .filter((event) => event.status === 'published')
        .map((event) => ({ school, event })),
    );

    expect(publishedSchools).toHaveLength(13);
    expect(publishedEvents).toHaveLength(15);
    expect(
      publishedEvents
        .filter(({ school }) => school.status !== 'published')
        .map(({ school, event }) => `${school.slug}|${event.starts_at}|${event.type}`),
    ).toEqual([]);
  });

  it('enforces tri-state values and registration URL invariants across all records', () => {
    const { ok } = validateSchoolFiles(loadAll());

    for (const school of ok) {
      expect([true, false, null]).toContain(school.has_boarding);

      for (const event of school.open_days) {
        expect([true, false, null]).toContain(event.registration_required);

        if (event.registration_required === true) {
          expect(event.registration_url).toMatch(/^https:\/\//);
        } else {
          expect(event.registration_url ?? null).toBeNull();
        }
      }
    }
  });

  it('covers every currently published identity exactly once in the publication-critical matrix', () => {
    const lines = readFileSync(AUDIT_PATH, 'utf8').split('\n');
    const matrixRows: { kind: 'school' | 'event'; identity: string; result: string }[] = [];
    let inMatrix = false;

    for (const line of lines) {
      if (line.startsWith('## Publication-critical matrix')) {
        inMatrix = true;
        continue;
      }
      if (inMatrix && line.startsWith('## ')) break;
      if (!inMatrix || !line.startsWith('|') || line.startsWith('|---') || line.startsWith('| Kind |')) {
        continue;
      }

      const match = line.match(/^\| (school|event) \| `([^`]+)` \| (PASS|FAIL) \|/);
      if (!match) continue;
      const [, kind, identity, result] = match!;
      matrixRows.push({ kind: kind as 'school' | 'event', identity, result });
    }

    const { ok } = validateSchoolFiles(loadAll());
    const publishedSchoolIdentities = ok
      .filter((school) => school.status === 'published')
      .map((school) => school.slug);
    const publishedEventIdentities = ok.flatMap((school) =>
      school.open_days
        .filter((event) => event.status === 'published')
        .map((event) => `${school.slug}|${event.starts_at}|${event.type}`),
    );

    const matrixSchoolIdentities = matrixRows
      .filter((row) => row.kind === 'school' && row.result === 'PASS')
      .map((row) => row.identity);
    const matrixEventIdentities = matrixRows
      .filter((row) => row.kind === 'event' && row.result === 'PASS')
      .map((row) => row.identity);

    expect(new Set(matrixSchoolIdentities).size).toBe(matrixSchoolIdentities.length);
    expect(new Set(matrixEventIdentities).size).toBe(matrixEventIdentities.length);
    expect(matrixSchoolIdentities.sort()).toEqual(publishedSchoolIdentities.sort());
    expect(matrixEventIdentities.sort()).toEqual(publishedEventIdentities.sort());
  });

  it('covers every nullable field exactly once in the audit ledger', () => {
    const { schoolRows, eventRows } = parseAuditRows();
    const { ok } = validateSchoolFiles(loadAll());

    expect(schoolRows).toHaveLength(40);
    expect(eventRows).toHaveLength(26);

    const schoolRowByFile = new Map(schoolRows.map((row) => [row.file, row]));
    const eventRowByIdentity = new Map(eventRows.map((row) => [`${row.file}|${row.identity}`, row]));

    const duplicateSchoolRows = schoolRows
      .map((row) => row.file)
      .filter((value, index, all) => all.indexOf(value) !== index);

    const duplicateEventRows = eventRows
      .map((row) => `${row.file}|${row.identity}`)
      .filter((value, index, all) => all.indexOf(value) !== index);

    expect(duplicateSchoolRows).toEqual([]);
    expect(duplicateEventRows).toEqual([]);

    const missingSchoolRows: string[] = [];
    const missingEventRows: string[] = [];

    for (const school of ok) {
      const filename = `${school.slug}.json`;
      const schoolRow = schoolRowByFile.get(filename);

      if (!schoolRow) {
        missingSchoolRows.push(filename);
      } else {
        expect(schoolRow.field).toBe('has_boarding');
        expect(schoolRow.identity).toBe('—');
        expect(schoolRow.after).toBe(asBooleanLiteral(school.has_boarding));
      }

      for (const event of school.open_days) {
        const identity = `${event.starts_at} + ${event.type}`;
        const eventKey = `${filename}|${identity}`;
        const eventRow = eventRowByIdentity.get(eventKey);

        if (!eventRow) {
          missingEventRows.push(eventKey);
          continue;
        }

        expect(eventRow.field).toBe('registration_required');
        expect(eventRow.after).toBe(asBooleanLiteral(event.registration_required));
      }
    }

    const expectedSchoolFiles = new Set(ok.map((school) => `${school.slug}.json`));
    const expectedEvents = new Set(
      ok.flatMap((school) =>
        school.open_days.map((event) => `${school.slug}.json|${event.starts_at} + ${event.type}`),
      ),
    );

    const extraSchoolRows = schoolRows
      .map((row) => row.file)
      .filter((file) => !expectedSchoolFiles.has(file));

    const extraEventRows = eventRows
      .map((row) => `${row.file}|${row.identity}`)
      .filter((identity) => !expectedEvents.has(identity));

    expect(missingSchoolRows).toEqual([]);
    expect(missingEventRows).toEqual([]);
    expect(extraSchoolRows).toEqual([]);
    expect(extraEventRows).toEqual([]);
  });
});
