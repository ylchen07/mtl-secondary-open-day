'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { EmptyState } from './EmptyState';
import { EventCard } from './EventCard';
import { PastEvents } from './PastEvents';
import { FilterBar } from './FilterBar';
import { formatDayHeading, groupByDay, partitionAgendaEvents } from '@/lib/dates';
import { EMPTY_FILTERS, applyFilters, serializeFilters, type FilterState } from '@/lib/filters';
import { findClashes } from '@/lib/clash';
import type { AgendaEvent } from '@/lib/types';
import type { Locale } from '@/lib/constants';

export function AgendaClient({
  events,
  initialFilters,
  referenceTime,
}: {
  events: AgendaEvent[];
  initialFilters: FilterState;
  referenceTime: string;
}) {
  const t = useTranslations('agenda');
  const locale = useLocale() as Locale;
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  // A shared cutoff keeps server HTML and browser hydration consistent.
  const { upcoming, past } = useMemo(
    () => partitionAgendaEvents(visible, new Date(referenceTime)),
    [visible, referenceTime],
  );
  const upcomingDays = useMemo(() => groupByDay(upcoming), [upcoming]);

  const isFiltered =
    filters.q !== '' ||
    filters.boarding ||
    filters.language.length + filters.region.length + filters.gender.length + filters.type.length > 0;

  return (
    <div className="agenda-layout">
      <aside aria-label={t('filtersLandmark')} className="filter-sidebar">
        <div className="filter-heading">
          <h2 className="desktop-filter-title">{t('filtersLandmark')}</h2>
          <button
            type="button"
            className="mobile-filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls="agenda-filters"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            {t('filtersLandmark')}
            <span aria-hidden="true">{filtersOpen ? '−' : '+'}</span>
          </button>
          {isFiltered && (
            <button type="button" className="text-button" onClick={() => update(EMPTY_FILTERS)}>
              {t('clearFilters')}
            </button>
          )}
        </div>
        <div id="agenda-filters" className="filter-options" data-open={filtersOpen}>
          <FilterBar filters={filters} onChange={update} />
        </div>
      </aside>

      <section id="events" aria-label={t('eventsLandmark')} className="agenda-results" tabIndex={-1}>
        <p className="result-count" role="status">{t('resultCount', { count: visible.length })}</p>
        {visible.length === 0 ? (
          <EmptyState filtered={isFiltered} onClear={() => update(EMPTY_FILTERS)} />
        ) : (
          <div className="agenda-sections">
            {upcomingDays.length > 0 && (
              <section aria-labelledby="upcoming-events-heading" className="agenda-section">
                <div className="section-heading">
                  <h2 id="upcoming-events-heading">{t('upcomingHeading')}</h2>
                  <span className="section-count">{t('dayCount', { count: upcoming.length })}</span>
                </div>
                <div className="agenda-days">
                  {upcomingDays.map((day) => (
                    <div key={day.day} className="agenda-day">
                      <div className="day-heading">
                        <h3><time dateTime={day.day}>{formatDayHeading(day.day, locale)}</time></h3>
                        <span>{t('dayCount', { count: day.events.length })}</span>
                      </div>
                      <div className="day-events">
                        {day.events.map((event) => (
                          <EventCard key={event.id} event={event} clashes={clashes.get(event.id) ?? []} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {past.length > 0 && <PastEvents events={past} />}
          </div>
        )}
      </section>
    </div>
  );
}
