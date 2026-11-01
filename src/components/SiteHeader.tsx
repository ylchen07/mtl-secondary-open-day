'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

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
      <Link href={pathname} locale={locale === 'en' ? 'fr' : 'en'} hrefLang={locale === 'en' ? 'fr' : 'en'} className="locale-switch">
        {t('otherLocale')}
      </Link>
    </header>
  );
}
