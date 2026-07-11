import { toPositiveInt } from './utils.js';

export const config = {
  port: toPositiveInt(process.env.PORT, 3000),
  host: process.env.APP_HOST || '0.0.0.0',
  version: process.env.APP_VERSION || '1.0.0',
  dataDir: process.env.DATA_DIR || '/data',
  requestTtlMinutes: toPositiveInt(process.env.REQUEST_TTL_MINUTES, 60),
  downloadTtlMinutes: toPositiveInt(process.env.DOWNLOAD_TTL_MINUTES, 60),
  downloadMaxCount: toPositiveInt(process.env.DOWNLOAD_MAX_COUNT, 3),
  cleanupIntervalMinutes: toPositiveInt(process.env.CLEANUP_INTERVAL_MINUTES, 15),
  maxConcurrentRequests: toPositiveInt(process.env.MAX_CONCURRENT_REQUESTS, 3),
};
