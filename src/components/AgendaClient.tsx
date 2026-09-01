'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { EmptyState } from './EmptyState';
import { EventCard } from './EventCard';
import { FilterBar } from './FilterBar';
import { groupByWeek } from '@/lib/dates';
import { EMPTY_FILTERS, applyFilters, serializeFilters, type FilterState } from '@/lib/filters';
import { findClashes } from '@/lib/clash';
import type { AgendaEvent } from '@/lib/types';
import type { Locale } from '@/lib/constants';

export function AgendaClient({
  events,
  initialFilters,
}: {
  events: AgendaEvent[];
  initialFilters: FilterState;
}) {
  const t = useTranslations('agenda');
  const locale = useLocale() as Locale;
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  function update(next: FilterState): void {
    setFilters(next);
    const query = serializeFilters(next).toString();
    // Keep the URL shareable without re-running the server component.
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }

  const visible = useMemo(() => applyFilters(events, filters), [events, filters]);
  // Clashes are computed over ALL events, not the filtered subset: a conflict
  // with a school you filtered out is still a conflict on your calendar.
  const clashes = useMemo(() => findClashes(events), [events]);
  const weeks = useMemo(() => groupByWeek(visible), [visible]);

  const isFiltered =
    filters.q !== '' ||
    filters.language.length + filters.region.length + filters.gender.length + filters.type.length > 0;

  return (
    <div className="grid gap-8 md:grid-cols-[16rem_1fr]">
      <aside>
        <FilterBar filters={filters} onChange={update} />
      </aside>

      <section>
        <p className="mb-4 text-sm text-neutral-500">
          {t('resultCount', { count: visible.length })}
        </p>

        {visible.length === 0 ? (
          <EmptyState filtered={isFiltered} onClear={() => update(EMPTY_FILTERS)} />
        ) : (
          <div className="space-y-8">
            {weeks.map((week) => (
              <div key={week.weekStart}>
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
                  {new Intl.DateTimeFormat(locale, {
                    month: 'long',
                    day: 'numeric',
                    timeZone: 'UTC',
                  }).format(new Date(`${week.weekStart}T12:00:00Z`))}
                </h2>
                <div className="space-y-3">
                  {week.events.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      clashes={clashes.get(event.id) ?? []}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
