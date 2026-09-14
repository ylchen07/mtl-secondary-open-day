'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { EmptyState } from './EmptyState';
import { EventCard } from './EventCard';
import { FilterBar } from './FilterBar';
import { formatDayHeading, groupByDay } from '@/lib/dates';
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
  const days = useMemo(() => groupByDay(visible), [visible]);

  const isFiltered =
    filters.q !== '' ||
    filters.language.length + filters.region.length + filters.gender.length + filters.type.length > 0;

  return (
    <div className="grid gap-8 md:grid-cols-[16rem_1fr] md:gap-10">
      <aside aria-label={t('filtersLandmark')}>
        <FilterBar filters={filters} onChange={update} />
      </aside>

      <section aria-label={t('eventsLandmark')}>
        <p className="mb-4 text-[13px] text-(--ink-3)">
          {t('resultCount', { count: visible.length })}
        </p>

        {visible.length === 0 ? (
          <EmptyState filtered={isFiltered} onClear={() => update(EMPTY_FILTERS)} />
        ) : (
          <div className="space-y-9">
            {days.map((day) => (
              <div key={day.day}>
                <div className="flex items-baseline gap-3 border-b border-(--rule-strong) pb-2">
                  <h2 className="font-(--font-serif) text-[23px] font-medium leading-tight tracking-[-0.01em]">
                    {formatDayHeading(day.day, locale)}
                  </h2>
                  <span className="ml-auto text-[12px] text-(--ink-3)">
                    {t('dayCount', { count: day.events.length })}
                  </span>
                </div>
                <div>
                  {day.events.map((event) => (
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
