'use client';

import { useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { LOCALES, LOCALE_NAMES, LOCALE_TAGS, type Locale } from '@/lib/constants';

export function SiteHeader() {
  const t = useTranslations('nav');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const section = pathname.startsWith('/events') ? 'events' : 'schools';
  const menu = useRef<HTMLDetailsElement>(null);

  // A native disclosure, so it works before hydration; this adds what a menu is expected
  // to do: close on a click elsewhere, and on Escape with focus back on its toggle.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (menu.current?.open && !menu.current.contains(event.target as Node)) menu.current.open = false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !menu.current?.open) return;
      menu.current.open = false;
      menu.current.querySelector('summary')?.focus();
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

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
      <details ref={menu} className="locale-menu">
        <summary className="locale-switch">
          <span className="sr-only">{t('languages')}: </span>
          {LOCALE_NAMES[locale]}
          <svg aria-hidden="true" viewBox="0 0 16 16" className="locale-chevron" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <ul className="locale-options" aria-label={t('languages')}>
          {LOCALES.map((code) => (
            <li key={code}>
              <Link
                href={pathname}
                locale={code}
                hrefLang={LOCALE_TAGS[code]}
                lang={LOCALE_TAGS[code]}
                aria-current={code === locale ? 'true' : undefined}
                onClick={() => { if (menu.current) menu.current.open = false; }}
              >
                {LOCALE_NAMES[code]}
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </header>
  );
}
