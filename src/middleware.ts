import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

// Deliberately `middleware.ts`, not Next 16's `proxy.ts`: a proxy always runs
// on the Node.js runtime, which OpenNext's Cloudflare adapter supports only
// experimentally. Middleware runs on the edge runtime, which it supports.
// Next prints a deprecation warning for this file; it is expected.
export default createMiddleware(routing);

export const config = {
  matcher: ['/', '/(en|fr)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
