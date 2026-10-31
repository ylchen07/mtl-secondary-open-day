'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { EmptyState } from './EmptyState';
import { EventCard } from './EventCard';
import { FilterPanel, isFiltered, useUrlFilters } from './FilterPanel';
import { PastEvents } from './PastEvents';
import { formatDayHeading, groupByDay, partitionAgendaEvents } from '@/lib/dates';
import { EMPTY_FILTERS, applyFilters, type FilterState } from '@/lib/filters';
import { findClashes } from '@/lib/clash';
import type { AgendaEvent } from '@/lib/types';
import type { Locale } from '@/lib/constants';

export function EventsClient({
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
  const [filters, update] = useUrlFilters(initialFilters);

  const now = useMemo(() => new Date(referenceTime), [referenceTime]);
  const visible = useMemo(() => applyFilters(events, filters), [events, filters]);
  // Clashes are computed over ALL events, not the filtered subset: a conflict
  // with a school you filtered out is still a conflict on your calendar.
  const clashes = useMemo(() => findClashes(events), [events]);
  // A shared cutoff keeps server HTML and browser hydration consistent.
  const { upcoming, past } = useMemo(() => partitionAgendaEvents(visible, now), [visible, now]);
  const upcomingDays = useMemo(() => groupByDay(upcoming), [upcoming]);

  return (
    <>
      <FilterPanel filters={filters} facets={['type', 'region', 'sector', 'language', 'gender']} onChange={update} />

      <section aria-label={t('eventsLandmark')} className="event-results">
        <p className="result-count" role="status">{t('resultCount', { count: visible.length })}</p>
        {visible.length === 0 ? (
          <EmptyState filtered={isFiltered(filters)} onClear={() => update(EMPTY_FILTERS)} />
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
    </>
  );
}
