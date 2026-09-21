'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { dayKey, formatDayHeading, formatEventRange, formatVerifiedDate } from '@/lib/dates';
import type { Locale } from '@/lib/constants';
import type { AgendaEvent } from '@/lib/types';

export function PastEvents({ events }: { events: AgendaEvent[] }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('agenda');
  const tType = useTranslations('eventType');
  const tLanguage = useTranslations('language');
  const tGender = useTranslations('gender');
  const locale = useLocale() as Locale;

  return (
    <section className="past-archive" aria-labelledby="past-events-heading">
      <div className="archive-heading">
        <h2 id="past-events-heading">{t('pastHeading')}</h2>
        <span className="section-count">{t('dayCount', { count: events.length })}</span>
        <button
          type="button"
          className="archive-toggle text-button"
          aria-expanded={open}
          aria-controls="past-event-list"
          onClick={() => setOpen(!open)}
        >
          {t(open ? 'hidePast' : 'showPast')}
        </button>
      </div>
      <p className="archive-description">{t('pastDescription')}</p>
      <div id="past-event-list" className="archive-list" hidden={!open}>
        {events.map((event) => {
          const name = locale === 'fr' ? event.school.name_fr : event.school.name_en;
          const note = locale === 'fr' ? event.notes_fr : event.notes_en;
          const date = dayKey(event.starts_at);

          return (
            <article key={event.id} className="archive-event">
              <details className="archive-event-details">
                <summary className="archive-summary">
                  <time dateTime={date}>{formatDayHeading(date, locale)}</time>
                  <h3>{name}</h3>
                  <span className="archive-event-type">{tType(event.type)}</span>
                  <span className="archive-details-label">{t('eventDetails')}</span>
                </summary>
                <div className="archive-event-body">
                  <p className="event-time">{formatEventRange(event.starts_at, event.ends_at, locale)}</p>
                  <ul className="event-details" aria-label={t('schoolDetails')}>
                    <li>{event.school.city}</li>
                    <li>{tLanguage(event.school.language)}</li>
                    <li>{tGender(event.school.gender)}</li>
                  </ul>
                  {note && <p className="event-note">{note}</p>}
                  <p className="event-evidence">{t('verifiedOn', { date: formatVerifiedDate(event.last_verified_at, locale) })}</p>
                </div>
              </details>
              <a className="archive-source" href={event.source_url} target="_blank" rel="noopener noreferrer">
                {t('source')}<span className="sr-only">: {name}</span>
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}
