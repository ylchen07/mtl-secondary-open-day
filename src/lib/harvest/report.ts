import type { HarvestDecision } from './reconcile';

/**
 * Render `harvest-report.md`: the only artifact a human reads before
 * publishing anything this run produced. Every skip and conflict reason is
 * printed verbatim (never summarised into a category), so a reviewer can
 * always tell *why* a school did not become a draft — out of scope, already
 * published, stale, untimed, an intra-batch slug collision, or a possible
 * duplicate of a school already on file — without cross-referencing code.
 */
export function renderReport(
  decisions: HarvestDecision[],
  flagged: string[],
  skippedAsPrimary: string[] = [],
): string {
  const created = decisions.filter((d) => d.kind === 'create');
  const skipped = decisions.filter((d) => d.kind === 'skip');
  const conflicts = decisions.filter((d) => d.kind === 'conflict');

  const lines = [
    '# FEEP harvest report',
    '',
    'Every file below is a **draft**. Drafts are invisible to the site.',
    'Before publishing, open the school\u2019s own admissions page, confirm the',
    'date and time, replace `source_url`, stamp `last_verified_at`, confirm',
    '`gender`, and set `status` to `published`.',
    '',
    `- Created: **${created.length}**`,
    `- Skipped: **${skipped.length}**`,
    `- Conflicts needing adjudication: **${conflicts.length}**`,
    `- Gender unconfirmed: **${flagged.length}**`,
    `- Excluded as primary-only: **${skippedAsPrimary.length}**`,
    '',
  ];

  // The count alone forces a human to re-derive which schools need the extra
  // gender check by re-running the harvester's own logic — exactly the kind
  // of triage this report exists to save them from doing.
  if (flagged.length > 0) {
    lines.push('## Gender unconfirmed — verify before publishing', '');
    for (const slug of flagged) lines.push(`- \`${slug}\``);
    lines.push('');
  }

  // A school excluded as primary-only leaves no other trace. If a real secondary
  // school lands here, this list is the only chance anyone has to notice.
  if (skippedAsPrimary.length > 0) {
    lines.push('## Excluded as primary-only \u2014 skim for mistakes', '');
    for (const slug of skippedAsPrimary) lines.push(`- \`${slug}\``);
    lines.push('');
  }

  if (conflicts.length > 0) {
    lines.push('## Conflicts — resolve by hand', '');
    for (const c of conflicts) {
      if (c.kind === 'conflict') {
        lines.push(`- \`${c.slug}\` vs existing \`${c.existingSlug}\` — ${c.reason}`);
      }
    }
    lines.push('');
  }

  lines.push('## Created drafts', '');
  for (const c of created) lines.push(`- [ ] \`${c.slug}\``);
  lines.push('', '## Skipped', '');
  for (const s of skipped) {
    if (s.kind === 'skip') lines.push(`- \`${s.slug}\` — ${s.reason}`);
  }

  return `${lines.join('\n')}\n`;
}
