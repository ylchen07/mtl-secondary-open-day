'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { dayKey, formatDayHeading, formatEventRange, formatVerifiedDate } from '@/lib/dates';
import { mapRegionFor } from '@/lib/regions';
import type { SchoolListRow } from '@/lib/schools';
import type { Locale } from '@/lib/constants';

export function SchoolList({ rows }: { rows: SchoolListRow[] }) {
  const t = useTranslations('agenda');
  const tType = useTranslations('eventType');
  const tLanguage = useTranslations('language');
  const tGender = useTranslations('gender');
  const tSector = useTranslations('sector');
  const tRegion = useTranslations('region');
  const locale = useLocale() as Locale;

  return (
    <ul className="school-list">
      {rows.map(({ school, next, moreUpcoming }) => {
        const name = locale === 'fr' ? school.name_fr : school.name_en;
        const description = locale === 'fr' ? school.description_fr : school.description_en;
        const day = next ? dayKey(next.starts_at) : null;
        return (
          <li key={school.id} className="school-row" data-region={mapRegionFor(school.region)}>
            <div className="row-main">
              <h3 className="row-name">
                <Link href={`/schools/${school.slug}`}>{name}</Link>
              </h3>
              {description && <p className="row-description">{description}</p>}
              <ul className="row-facts" aria-label={t('schoolDetails')}>
                <li>{tSector(school.sector)}</li>
                {school.language && <li>{tLanguage(school.language)}</li>}
                {school.gender && <li>{tGender(school.gender)}</li>}
              </ul>
            </div>
            <p className="row-place">
              <span className="region-swatch" aria-hidden="true" />
              <span>
                {school.city}
                <span className="row-region">{tRegion(school.region)}</span>
              </span>
            </p>
            <div className="row-next">
              {next && day ? (
                <>
                  <time dateTime={day} className="next-date">{formatDayHeading(day, locale)}</time>
                  <p className="next-meta">
                    <span className="type-cap" data-type={next.type}>{tType(next.type)}</span>
                    <span>{formatEventRange(next, locale) ?? t('timeNotPublished')}</span>
                  </p>
                  <p className="next-evidence">
                    <a href={next.source_url} target="_blank" rel="noopener noreferrer">
                      {t('source')}<span className="visually-hidden">: {name}</span>
                    </a>
                    {moreUpcoming > 0 && <span>{t('moreUpcoming', { count: moreUpcoming })}</span>}
                  </p>
                </>
              ) : (
                <>
                  <p className="no-event">{t('noUpcoming')}</p>
                  <p className="next-evidence">{t('checkedOn', { date: formatVerifiedDate(school.last_verified_at, locale) })}</p>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
