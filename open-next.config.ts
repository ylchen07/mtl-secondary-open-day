import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

// The data only changes when a commit is deployed, so prerendered pages are
// served read-only from the Worker's static assets: no R2 bucket or KV needed.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
