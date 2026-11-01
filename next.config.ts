import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // fetchAgendaEvents() reads data/schools/*.json with a runtime
  // fs.readdirSync, which the build's static file tracer cannot follow
  // (it only sees literal imports/requires). Without this, the files
  // would be missing from the deployed serverless function.
  outputFileTracingIncludes: {
    '/*': ['./data/schools/**/*.json'],
  },
  async redirects() {
    return [
      // School years used to live at /en/2027-2028; they moved under /events.
      {
        source: '/:locale(en|fr)/:year(\\d{4}-\\d{4})',
        destination: '/:locale/events/:year',
        permanent: true,
      },
      // The events page always names its year; `current` follows the season.
      // Temporary, so /events stays free to become something else later.
      {
        source: '/:locale(en|fr)/events',
        destination: '/:locale/events/current',
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
