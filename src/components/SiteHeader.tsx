'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { LOCALES, LOCALE_NAMES, LOCALE_TAGS } from '@/lib/constants';

export function SiteHeader() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const section = pathname.startsWith('/events') ? 'events' : 'schools';

  return (
    <header className="site-header">
      <a className="skip-link" href="#main">{t('skip')}</a>
      <Link href="/" className="wordmark">{t('siteName')}</Link>
      <nav aria-label={t('label')} className="site-nav">
        <Link href="/" className="nav-link" data-active={section === 'schools' || undefined} aria-current={pathname === '/' ? 'page' : undefined}>
          {t('schools')}
        </Link>
        <Link href="/events/current" className="nav-link" data-active={section === 'events' || undefined} aria-current={pathname === '/events/current' ? 'page' : undefined}>
          {t('events')}
        </Link>
      </nav>
      <ul className="locale-switches" aria-label={t('languages')}>
        {LOCALES.filter((other) => other !== locale).map((other) => (
          <li key={other}>
            <Link href={pathname} locale={other} hrefLang={LOCALE_TAGS[other]} lang={LOCALE_TAGS[other]} className="locale-switch">
              {LOCALE_NAMES[other]}
            </Link>
          </li>
        ))}
      </ul>
    </header>
  );
}
