import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

const config = {
  ...defineCloudflareConfig({
    // The data only changes when a commit is deployed, so prerendered pages are
    // served read-only from the Worker's static assets: no R2 bucket or KV needed.
    incrementalCache: staticAssetsIncrementalCache,
  }),
  // The same `pnpm build` Vercel runs, so both hosts build the app one way.
  buildCommand: 'pnpm build',
};

export default config;
