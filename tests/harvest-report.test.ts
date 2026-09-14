import { describe, it, expect } from 'vitest';
import { renderReport } from '@/lib/harvest/report';
import type { HarvestDecision } from '@/lib/harvest/reconcile';
import type { ListingEntry } from '@/lib/harvest/types';

const entry = (feepSlug: string): ListingEntry => ({
  feepSlug,
  nameFr: 'École Test',
  region: 'montreal_island',
  externalUrl: null,
  events: [],
});

describe('renderReport', () => {
  it('counts created, skipped, conflicts, gender-unconfirmed, and primary-only exclusions', () => {
    const decisions: HarvestDecision[] = [
      { kind: 'create', slug: 'school-a', entry: entry('school-a') },
      { kind: 'skip', slug: 'school-b', reason: 'already published — a human verified this; never machine-overwrite a published file' },
    ];
    const report = renderReport(decisions, ['school-a'], ['primary-school']);
    expect(report).toContain('- Created: **1**');
    expect(report).toContain('- Skipped: **1**');
    expect(report).toContain('- Conflicts needing adjudication: **0**');
    expect(report).toContain('- Gender unconfirmed: **1**');
    expect(report).toContain('- Excluded as primary-only: **1**');
  });

  it('lists every created slug as an unchecked checkbox', () => {
    const decisions: HarvestDecision[] = [
      { kind: 'create', slug: 'school-a', entry: entry('school-a') },
    ];
    const report = renderReport(decisions, []);
    expect(report).toContain('- [ ] `school-a`');
  });

  it('prints the intra-batch duplicate-slug skip reason verbatim, distinct from other skip reasons', () => {
    const decisions: HarvestDecision[] = [
      {
        kind: 'skip',
        slug: 'dup-school',
        reason: 'duplicate FEEP slug "dup-school" within this harvest run — an earlier entry already claims this filename',
      },
      {
        kind: 'skip',
        slug: 'out-of-scope',
        reason: 'no Greater Montreal region — out of scope for this site',
      },
    ];
    const report = renderReport(decisions, []);
    expect(report).toContain(
      '- `dup-school` — duplicate FEEP slug "dup-school" within this harvest run — an earlier entry already claims this filename',
    );
    expect(report).toContain('- `out-of-scope` — no Greater Montreal region — out of scope for this site');
  });

  it('surfaces a conflict\u2019s existingSlug so a human can adjudicate which file describes the same school', () => {
    const decisions: HarvestDecision[] = [
      {
        kind: 'conflict',
        slug: 'college-jean-de-brebeuf-montreal',
        existingSlug: 'college-jean-de-brebeuf',
        reason: 'FEEP slug differs from ours for what looks like the same school — adjudicate before writing',
      },
    ];
    const report = renderReport(decisions, []);
    expect(report).toContain(
      '- `college-jean-de-brebeuf-montreal` vs existing `college-jean-de-brebeuf` — FEEP slug differs from ours for what looks like the same school — adjudicate before writing',
    );
  });

  it('lists primary-only exclusions by slug so a mis-scoped secondary school is not lost silently', () => {
    const report = renderReport([], [], ['maybe-secondary-school']);
    expect(report).toContain('## Excluded as primary-only');
    expect(report).toContain('- `maybe-secondary-school`');
  });

  it('lists gender-unconfirmed drafts BY NAME, not just as a count — a human must not have to re-derive which schools need the check', () => {
    const decisions: HarvestDecision[] = [
      { kind: 'create', slug: 'ecole-un', entry: entry('ecole-un') },
      { kind: 'create', slug: 'ecole-deux', entry: entry('ecole-deux') },
    ];
    const report = renderReport(decisions, ['ecole-un', 'ecole-deux']);
    expect(report).toContain('## Gender unconfirmed — verify before publishing');
    expect(report).toContain('- `ecole-un`');
    expect(report).toContain('- `ecole-deux`');
  });

  it('omits the Gender unconfirmed section entirely when nothing is flagged', () => {
    const report = renderReport([], []);
    expect(report).not.toContain('Gender unconfirmed — verify');
  });

  it('produces the exact report text for a fixed, empty input', () => {
    const report = renderReport([], []);
    expect(report).toBe(
      [
        '# FEEP harvest report',
        '',
        'Every file below is a **draft**. Drafts are invisible to the site.',
        'Before publishing, open the school\u2019s own admissions page, confirm the',
        'date and time, replace `source_url`, stamp `last_verified_at`, confirm',
        '`gender`, and set `status` to `published`.',
        '',
        '- Created: **0**',
        '- Skipped: **0**',
        '- Conflicts needing adjudication: **0**',
        '- Gender unconfirmed: **0**',
        '- Excluded as primary-only: **0**',
        '',
        '## Created drafts',
        '',
        '',
        '## Skipped',
        '',
      ].join('\n') + '\n',
    );
  });
});
