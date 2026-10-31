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
  // School years used to live at /en/2027-2028; they moved under /events.
  async redirects() {
    return [
      {
        source: '/:locale(en|fr)/:year(\\d{4}-\\d{4})',
        destination: '/:locale/events/:year',
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
