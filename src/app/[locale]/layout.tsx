import { Bricolage_Grotesque } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { routing } from '@/i18n/routing';
import '../globals.css';

const sans = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  axes: ['opsz'],
  variable: '--font-sans',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site' });
  return { title: t('title'), description: t('tagline') };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [tNav, tAgenda] = await Promise.all([
    getTranslations({ locale, namespace: 'nav' }),
    getTranslations({ locale, namespace: 'agenda' }),
  ]);

  return (
    <html lang={locale} className={sans.variable}>
      <body>
        <NextIntlClientProvider>
          <div className="site-shell">
            <SiteHeader />
            <main id="main" tabIndex={-1}>{children}</main>
            <footer className="site-footer">
              <span>{tNav('siteName')}</span>
              <p>{tAgenda('footerNote')}</p>
              <p className="map-credit">
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">{tNav('mapCredit')}</a>
              </p>
            </footer>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
