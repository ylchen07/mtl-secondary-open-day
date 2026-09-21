'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ClashIcon } from './ClashIcon';
import { formatEventRange, formatVerifiedDate } from '@/lib/dates';
import { registrationAction } from '@/lib/registration';
import type { AgendaEvent } from '@/lib/types';
import type { Locale } from '@/lib/constants';

export function EventCard({
  event,
  clashes,
  past = false,
}: {
  event: AgendaEvent;
  clashes: AgendaEvent[];
  past?: boolean;
}) {
  const t = useTranslations('agenda');
  const tType = useTranslations('eventType');
  const tLanguage = useTranslations('language');
  const tGender = useTranslations('gender');
  const locale = useLocale() as Locale;
  const schoolName = locale === 'fr' ? event.school.name_fr : event.school.name_en;
  const note = locale === 'fr' ? event.notes_fr : event.notes_en;
  const registration = registrationAction(event, past);

  return (
    <article className="agenda-event" data-past={past || undefined} aria-label={past ? t('pastEvent') : undefined}>
      <p className="event-time">{formatEventRange(event.starts_at, event.ends_at, locale)}</p>
      <div className="event-content">
        <div className="event-heading">
          <h4>{schoolName}</h4>
          <span className="event-type">{past ? t('pastEvent') : tType(event.type)}</span>
        </div>
        <ul className="event-details" aria-label={t('schoolDetails')}>
          <li>{event.school.city}</li>
          <li>{tLanguage(event.school.language)}</li>
          <li>{tGender(event.school.gender)}</li>
        </ul>
        {note && <p className="event-note">{note}</p>}
        {clashes.length > 0 && (
          <ul className="event-clashes">
            {clashes.map((clash) => (
              <li key={clash.id}>
                <ClashIcon />
                <span>{t('clashWith', {
                  school: locale === 'fr' ? clash.school.name_fr : clash.school.name_en,
                  type: tType(clash.type),
                })}</span>
              </li>
            ))}
          </ul>
        )}
        <footer className="event-footer">
          <div className="event-evidence">
            <span>{t('verifiedOn', { date: formatVerifiedDate(event.last_verified_at, locale) })}</span>
            <a href={event.source_url} target="_blank" rel="noopener noreferrer">{t('source')}</a>
          </div>
          {registration && (
            <a
              href={registration.href}
              className={registration.kind === 'register' ? 'button button-primary' : 'button button-secondary'}
              target="_blank"
              rel="noopener noreferrer"
            >
              {registration.kind === 'register' ? t('register') : t('checkRegistrationDetails')}
            </a>
          )}
        </footer>
      </div>
    </article>
  );
}
