'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ClashIcon } from './ClashIcon';
import { formatEventRange, formatVerifiedDate } from '@/lib/dates';
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
  const isExam = event.type === 'entrance_exam';

  return (
    <article
      className={`agenda-event grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-(--rule) py-4 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:gap-x-5 ${past ? 'text-(--ink-3)' : ''}`}
      aria-label={past ? t('pastEvent') : undefined}
    >
      <p
        className={`col-span-full pb-1 text-[13px] font-medium leading-5 sm:col-span-1 sm:pb-0 sm:pt-0.5 sm:text-sm ${past ? 'text-(--ink-3)' : 'text-(--ink)'}`}
      >
        {formatEventRange(event.starts_at, event.ends_at, locale)}
      </p>

      <div className="min-w-0 sm:col-span-1">
        <h3
          className={`text-[16px] font-medium leading-5 tracking-[-0.01em] sm:text-[17px] ${past ? 'text-(--ink-2)' : ''}`}
        >
          {schoolName}
        </h3>
        <p className="mt-1 flex flex-wrap gap-x-2 text-[12px] leading-5 text-(--ink-3)">
          <span>{event.school.city}</span>
          <span aria-hidden="true" className="text-(--rule-strong)">
            ·
          </span>
          <span>{tLanguage(event.school.language)}</span>
          <span aria-hidden="true" className="text-(--rule-strong)">
            ·
          </span>
          <span>{tGender(event.school.gender)}</span>
        </p>
        {note && (
          <p className="mt-1.5 max-w-[60ch] text-[13px] leading-5 text-(--ink-2)">
            {note}
          </p>
        )}
      </div>

      <span
        className={`shrink-0 self-start px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] ${
          past
            ? 'bg-(--paper-sunk) text-(--ink-3)'
            : isExam
              ? 'bg-(--exam-wash) text-(--exam)'
              : 'bg-(--paper-sunk) text-(--ink-2)'
        }`}
      >
        {past ? t('pastEvent') : tType(event.type)}
      </span>

      {clashes.length > 0 && (
        <ul className="col-span-full mt-2 space-y-1 bg-(--flag-wash) px-3 py-2 text-[13px] leading-5 text-(--flag) sm:col-start-2 sm:col-span-2">
          {clashes.map((clash) => (
            <li key={clash.id} className="flex items-start gap-2">
              <ClashIcon />
              <span>
                {t('clashWith', {
                  school: locale === 'fr' ? clash.school.name_fr : clash.school.name_en,
                  type: tType(clash.type),
                })}
              </span>
            </li>
          ))}
        </ul>
      )}

      <footer className="col-span-full mt-2 flex flex-wrap items-center gap-2 text-[12px] text-(--ink-3) sm:col-start-2 sm:col-span-2">
        <span>{t('verifiedOn', { date: formatVerifiedDate(event.last_verified_at, locale) })}</span>
        <span aria-hidden="true" className="text-(--rule-strong)">
          ·
        </span>
        <a
          href={event.source_url}
          className="text-(--ink-2) underline decoration-(--rule-strong) underline-offset-2 hover:decoration-(--ink-2)"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('source')}
        </a>
        {!past && event.registration_required && event.registration_url && (
          <a
            href={event.registration_url}
            className="ml-auto bg-(--ink) px-3 py-1.5 font-medium text-(--paper) transition-colors hover:bg-(--ink-2)"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('register')}
          </a>
        )}
      </footer>
    </article>
  );
}
