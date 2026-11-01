import type { CSSProperties } from 'react';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ClashIcon } from '@/components/ClashIcon';
import { RegionMap } from '@/components/RegionMap';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { findClashes } from '@/lib/clash';
import type { Locale } from '@/lib/constants';
import { dayKey, formatDayHeading, formatEventRange, formatVerifiedDate, isPastEvent } from '@/lib/dates';
import { regionCrop } from '@/lib/geo';
import { fetchAgendaEvents, fetchSchool, fetchSchoolListings } from '@/lib/queries';
import { mapRegionFor } from '@/lib/regions';

export const revalidate = 3600;

/**
 * The band is three times wider than tall. Phones zoom into it around the
 * school (or the region's centre) so the name sits on the land beneath it.
 */
const BAND_ASPECT = 3;

type Params = Promise<{ locale: string; slug: string }>;

export function generateStaticParams() {
  const slugs = fetchSchoolListings().map((school) => school.slug);
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: { params: Params }) {
  const { locale, slug } = await params;
  const school = fetchSchool(slug);
  if (!school) return {};
  const t = await getTranslations({ locale, namespace: 'site' });
  return { title: `${locale === 'fr' ? school.name_fr : school.name_en} · ${t('title')}` };
}

export default async function SchoolPage({ params }: { params: Params }) {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale as Locale;
  const school = fetchSchool(slug);
  if (!school) notFound();

  const now = new Date();
  const [allEvents, t] = await Promise.all([fetchAgendaEvents(now), getTranslations()]);
  const events = allEvents.filter((event) => event.school_id === school.id);
  const clashes = findClashes(allEvents);
  const years = [...new Set(events.map((event) => event.academic_year))].sort().reverse();
  const neighbours = fetchSchoolListings().filter((s) => s.region === school.region).length - 1;

  const name = locale === 'fr' ? school.name_fr : school.name_en;
  const description = locale === 'fr' ? school.description_fr : school.description_en;
  const region = mapRegionFor(school.region);
  const { view, focus } = regionCrop(region, BAND_ASPECT, school.location);
  const bandFrame = { '--focus-x': focus.x, '--focus-y': focus.y, '--view-aspect': view.w / view.h } as CSSProperties;
  const yearLabel = (y: string) => y.replace('-', '–');
  const money = new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });

  return (
    <article className="school-page" data-region={region}>
      <header className="school-band" style={bandFrame}>
        <RegionMap view={view} highlight={region} pin={school.location} label={`${t(`region.${school.region}`)} · ${name}`} className="band-map" />
        <div className="band-title">
          <Link href="/" className="back-link">
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M10 3.5 5.5 8l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('school.back')}
          </Link>
          <h1>{name}</h1>
          <ul className="fact-caps" aria-label={t('agenda.schoolDetails')}>
            <li className="region-cap">{t(`region.${school.region}`)}</li>
            <li>{school.city}</li>
            <li>{t(`sector.${school.sector}`)}</li>
            {school.language && <li>{t(`language.${school.language}`)}</li>}
            {school.gender && <li>{t(`gender.${school.gender}`)}</li>}
          </ul>
        </div>
      </header>

      <div className="school-body">
        <div className="school-main">
          <section aria-labelledby="about-heading" className="school-section">
            <h2 id="about-heading">{t('school.about')}</h2>
            {!school.confirmed && <p className="draft-note">{t('school.draftNote')}</p>}
            {description ? <p className="school-description">{description}</p> : <p className="gap">{t('school.noDescription')}</p>}
            <p className="checked">{t('school.checked', { date: formatVerifiedDate(school.last_verified_at, locale) })}</p>
          </section>

          <section aria-labelledby="events-heading" className="school-section">
            <h2 id="events-heading">{t('school.events')}</h2>
            {events.length === 0 && <p className="gap">{t('school.noEvents')}</p>}
            {years.map((year) => (
              <div key={year} className="year-group">
                <h3>
                  <Link href={`/events/${year}`}>{t('agenda.schoolYear', { year: yearLabel(year) })}</Link>
                </h3>
                <ol className="school-events">
                  {events.filter((event) => event.academic_year === year).map((event) => {
                    const day = dayKey(event.starts_at);
                    const past = isPastEvent(event.ends_at, now);
                    const note = locale === 'fr' ? event.notes_fr : event.notes_en;
                    const overlaps = past ? [] : (clashes.get(event.id) ?? []);
                    return (
                      <li key={event.id} className="school-event" data-past={past || undefined} data-clash={overlaps.length > 0 || undefined}>
                        <time dateTime={day} className="school-event-date">
                          {formatDayHeading(day, locale)}
                          <span>{day.slice(0, 4)}</span>
                        </time>
                        <div className="school-event-body">
                          <p className="school-event-meta">
                            <span className="type-cap" data-type={event.type}>{t(`eventType.${event.type}`)}</span>
                            {past && <span className="past-cap">{t('agenda.pastEvent')}</span>}
                            <span>{formatEventRange(event, locale) ?? t('agenda.timeNotPublished')}</span>
                          </p>
                          {note && <p className="event-note">{note}</p>}
                          {overlaps.length > 0 && (
                            <ul className="event-clashes">
                              {overlaps.map((clash) => (
                                <li key={clash.id}>
                                  <ClashIcon />
                                  <span>{t('agenda.clashWith', {
                                    school: locale === 'fr' ? clash.school.name_fr : clash.school.name_en,
                                    type: t(`eventType.${clash.type}`),
                                  })}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <p className="event-evidence">
                            <span>{t('agenda.verifiedOn', { date: formatVerifiedDate(event.last_verified_at, locale) })}</span>
                            <a href={event.source_url} target="_blank" rel="noopener noreferrer">{t('agenda.source')}</a>
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </section>
        </div>

        <aside className="school-aside" aria-labelledby="location-heading">
          <section className="aside-block">
            <h2 id="location-heading">{t('school.location')}</h2>
            {school.address ? <p className="address">{school.address}</p> : <p className="gap">{t('school.addressUnconfirmed')}</p>}
            <p className="position-note">
              {school.location
                ? school.location.precision === 'approximate' ? t('school.approximate') : null
                : t('school.positionUnknown')}
            </p>
            {neighbours > 0 && (
              <Link href={`/?region=${school.region}`} className="text-link">
                {t('school.moreInRegion', { count: neighbours, region: t(`region.${school.region}`) })}
              </Link>
            )}
          </section>

          {school.tuition_annual_cad != null && (
            <dl className="aside-block key-facts" aria-label={t('school.factsLabel')}>
              <div>
                <dt>{t('school.tuitionLabel')}</dt>
                <dd className="num">{t('school.tuition', { amount: money.format(school.tuition_annual_cad) })}</dd>
              </div>
            </dl>
          )}

          <div className="aside-actions">
            <a href={school.admissions_url} target="_blank" rel="noopener noreferrer" className="button button-primary">
              {t('agenda.admissionsPage')}
              <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5.5 10.5 10.5 5.5M6.5 5.5h4v4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a href={school.website_url} target="_blank" rel="noopener noreferrer" className="button button-secondary">
              {t('school.website')}
            </a>
          </div>
        </aside>
      </div>
    </article>
  );
}
