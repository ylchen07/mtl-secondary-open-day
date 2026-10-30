'use client';

import { useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { EmptyState } from './EmptyState';
import { EventCard } from './EventCard';
import { PastEvents } from './PastEvents';
import { FilterBar } from './FilterBar';
import { SchoolTable } from './SchoolTable';
import { formatDayHeading, groupByDay, partitionAgendaEvents } from '@/lib/dates';
import { EMPTY_FILTERS, applyFilters, serializeFilters, type FilterState } from '@/lib/filters';
import { findClashes } from '@/lib/clash';
import { listSchools } from '@/lib/schools';
import type { AgendaEvent, SchoolListing } from '@/lib/types';
import type { Locale } from '@/lib/constants';

export type AgendaView = 'schools' | 'calendar';
const VIEWS: AgendaView[] = ['schools', 'calendar'];

/** The shareable query for a view: filters, plus `view` when it is not the default. */
function queryFor(filters: FilterState, view: AgendaView): string {
  const params = serializeFilters(filters);
  if (view === 'calendar') params.set('view', 'calendar');
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function AgendaClient({
  events,
  schools,
  initialFilters,
  initialView,
  referenceTime,
}: {
  events: AgendaEvent[];
  schools: SchoolListing[];
  initialFilters: FilterState;
  initialView: AgendaView;
  referenceTime: string;
}) {
  const t = useTranslations('agenda');
  const locale = useLocale() as Locale;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [view, setView] = useState<AgendaView>(initialView);
  const tabs = useRef<Record<AgendaView, HTMLAnchorElement | null>>({ schools: null, calendar: null });

  function replaceUrl(nextFilters: FilterState, nextView: AgendaView): void {
    // Keep the URL shareable without re-running the server component.
    window.history.replaceState(null, '', queryFor(nextFilters, nextView) || window.location.pathname);
  }

  function update(next: FilterState): void {
    setFilters(next);
    replaceUrl(next, view);
  }

  function select(next: AgendaView): void {
    setView(next);
    replaceUrl(filters, next);
  }

  function onTabClick(event: MouseEvent<HTMLAnchorElement>, next: AgendaView): void {
    event.preventDefault();
    select(next);
  }

  function onTabKey(event: KeyboardEvent<HTMLAnchorElement>): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length];
    select(next);
    tabs.current[next]?.focus();
  }

  const now = useMemo(() => new Date(referenceTime), [referenceTime]);
  const visible = useMemo(() => applyFilters(events, filters), [events, filters]);
  const rows = useMemo(
    () => listSchools(schools, visible, filters, now, locale),
    [schools, visible, filters, now, locale],
  );
  // Clashes are computed over ALL events, not the filtered subset: a conflict
  // with a school you filtered out is still a conflict on your calendar.
  const clashes = useMemo(() => findClashes(events), [events]);
  // A shared cutoff keeps server HTML and browser hydration consistent.
  const { upcoming, past } = useMemo(() => partitionAgendaEvents(visible, now), [visible, now]);
  const upcomingDays = useMemo(() => groupByDay(upcoming), [upcoming]);

  const isFiltered =
    filters.q !== '' ||
    filters.boarding ||
    filters.language.length + filters.region.length + filters.gender.length + filters.sector.length + filters.type.length > 0;

  const counts: Record<AgendaView, number> = { schools: rows.length, calendar: visible.length };

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
        <div className="view-bar">
          <div role="tablist" aria-label={t('viewsLabel')} className="view-tabs">
            {VIEWS.map((v) => (
              <a
                key={v}
                ref={(node) => { tabs.current[v] = node; }}
                role="tab"
                id={`tab-${v}`}
                href={queryFor(filters, v) || '?'}
                aria-selected={view === v}
                aria-controls={`panel-${v}`}
                tabIndex={view === v ? 0 : -1}
                className="view-tab"
                onClick={(event) => onTabClick(event, v)}
                onKeyDown={onTabKey}
              >
                {t(v === 'schools' ? 'viewSchools' : 'viewCalendar')}
                <span className="tab-count">{counts[v]}</span>
              </a>
            ))}
          </div>
          <p className="result-count" role="status">
            {view === 'schools' ? t('schoolCount', { count: rows.length }) : t('resultCount', { count: visible.length })}
          </p>
        </div>

        <div role="tabpanel" id="panel-schools" aria-labelledby="tab-schools" hidden={view !== 'schools'}>
          {rows.length === 0 ? (
            <EmptyState filtered={isFiltered} message={t('emptySchoolsFiltered')} onClear={() => update(EMPTY_FILTERS)} />
          ) : (
            <SchoolTable rows={rows} />
          )}
        </div>

        <div role="tabpanel" id="panel-calendar" aria-labelledby="tab-calendar" hidden={view !== 'calendar'}>
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
        </div>
      </section>
    </div>
  );
}
