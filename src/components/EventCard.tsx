'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatEventTime, formatVerifiedDate } from '@/lib/dates';
import type { AgendaEvent } from '@/lib/types';
import type { Locale } from '@/lib/constants';

export function EventCard({
  event,
  clashes,
}: {
  event: AgendaEvent;
  clashes: AgendaEvent[];
}) {
  const t = useTranslations('agenda');
  const tType = useTranslations('eventType');
  const locale = useLocale() as Locale;
  const schoolName = locale === 'fr' ? event.school.name_fr : event.school.name_en;

  return (
    <article className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium">{schoolName}</h3>
        <span className="shrink-0 rounded bg-neutral-100 px-2 py-0.5 text-xs">
          {tType(event.type)}
        </span>
      </div>

      <p className="mt-1 text-sm text-neutral-700">
        {formatEventTime(event.starts_at, event.ends_at, locale)}
      </p>
      <p className="text-sm text-neutral-500">{event.school.city}</p>

      {clashes.length > 0 && (
        <ul className="mt-2 space-y-1">
          {clashes.map((clash) => (
            <li key={clash.id} className="text-sm text-amber-700">
              {t('clashWith', {
                school: locale === 'fr' ? clash.school.name_fr : clash.school.name_en,
                type: tType(clash.type),
              })}
            </li>
          ))}
        </ul>
      )}

      {event.registration_required && event.registration_url && (
        <a
          href={event.registration_url}
          className="mt-3 inline-block rounded bg-neutral-900 px-3 py-1.5 text-sm text-white"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('register')}
        </a>
      )}

      <footer className="mt-3 text-xs text-neutral-500">
        {t('verifiedOn', { date: formatVerifiedDate(event.last_verified_at, locale) })}
        {' · '}
        <a
          href={event.source_url}
          className="underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('source')}
        </a>
      </footer>
    </article>
  );
}
