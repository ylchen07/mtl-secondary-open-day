'use client';

import { useLocale, useTranslations } from 'next-intl';
import { dayKey, formatDayHeading, formatEventRange, formatVerifiedDate } from '@/lib/dates';
import type { SchoolListRow } from '@/lib/schools';
import type { Locale } from '@/lib/constants';

export function SchoolTable({ rows }: { rows: SchoolListRow[] }) {
  const t = useTranslations('agenda');
  const tType = useTranslations('eventType');
  const tLanguage = useTranslations('language');
  const tGender = useTranslations('gender');
  const tSector = useTranslations('sector');
  const locale = useLocale() as Locale;

  return (
    <table className="school-table">
      <thead>
        <tr>
          <th scope="col">{t('colSchool')}</th>
          <th scope="col">{t('colNext')}</th>
          <th scope="col" className="admissions-head">{t('colAdmissions')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ school, next, moreUpcoming }) => {
          const name = locale === 'fr' ? school.name_fr : school.name_en;
          const day = next ? dayKey(next.starts_at) : null;
          return (
            <tr key={school.id}>
              <th scope="row" className="school-cell">
                <span className="school-name">{name}</span>
                <ul className="school-facts" aria-label={t('schoolDetails')}>
                  <li>{school.city}</li>
                  <li>{tSector(school.sector)}</li>
                  {school.language && <li>{tLanguage(school.language)}</li>}
                  {school.gender && <li>{tGender(school.gender)}</li>}
                </ul>
              </th>
              <td className="next-cell">
                {next && day ? (
                  <div className="next-event">
                    <time dateTime={day} className="next-date">{formatDayHeading(day, locale)}</time>
                    <p className="next-meta">
                      <span>{tType(next.type)}</span>
                      <span>{formatEventRange(next, locale) ?? t('timeNotPublished')}</span>
                    </p>
                    <p className="next-evidence">
                      <a href={next.source_url} target="_blank" rel="noopener noreferrer">
                        {t('source')}<span className="visually-hidden">: {name}</span>
                      </a>
                      {moreUpcoming > 0 && <span>{t('moreUpcoming', { count: moreUpcoming })}</span>}
                    </p>
                  </div>
                ) : (
                  <div className="next-event">
                    <p className="no-event">{t('noUpcoming')}</p>
                    <p className="next-evidence">
                      {t('checkedOn', { date: formatVerifiedDate(school.last_verified_at, locale) })}
                    </p>
                  </div>
                )}
              </td>
              <td className="admissions-cell">
                <a href={school.admissions_url} target="_blank" rel="noopener noreferrer" className="row-link">
                  {t('admissionsPage')}<span className="visually-hidden">: {name}</span>
                </a>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
