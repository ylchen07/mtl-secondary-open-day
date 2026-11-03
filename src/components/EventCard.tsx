'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ClashIcon } from './ClashIcon';
import { Link } from '@/i18n/navigation';
import { formatEventRange, formatVerifiedDate } from '@/lib/dates';
import { mapRegionFor } from '@/lib/regions';
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
  const tSector = useTranslations('sector');
  const locale = useLocale() as Locale;
  const schoolName = locale === 'fr' ? event.school.name_fr : event.school.name_en;
  const note = locale === 'fr' ? event.notes_fr : event.notes_en;
  const registration = registrationAction(event, past);

  return (
    <article
      className="agenda-event"
      data-past={past || undefined}
      data-clash={clashes.length > 0 || undefined}
      data-region={mapRegionFor(event.school.region)}
      aria-label={past ? t('pastEvent') : undefined}
    >
      <p className="event-time">{formatEventRange(event, locale) ?? t('timeNotPublished')}</p>
      <div className="event-content">
        <div className="event-heading">
          <h4><Link href={`/schools/${event.school.slug}`}>{schoolName}</Link></h4>
          <span className="event-type type-cap" data-type={past ? undefined : event.type}>{past ? t('pastEvent') : tType(event.type)}</span>
        </div>
        <ul className="event-details" aria-label={t('schoolDetails')}>
          <li className="event-place"><span className="region-swatch" aria-hidden="true" />{event.school.city}</li>
          {event.school.language && <li>{tLanguage(event.school.language)}</li>}
          {event.school.gender && <li>{tGender(event.school.gender)}</li>}
          <li>{tSector(event.school.sector)}</li>
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
