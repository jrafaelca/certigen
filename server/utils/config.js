import { createRequire } from 'node:module';
import { toPositiveInt } from './utils.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

export const config = {
  port: toPositiveInt(process.env.PORT, 3000),
  host: process.env.APP_HOST || '0.0.0.0',
  version,
  dataDir: process.env.DATA_DIR || '/data',
  requestTtlMinutes: toPositiveInt(process.env.REQUEST_TTL_MINUTES, 60),
  downloadTtlMinutes: toPositiveInt(process.env.DOWNLOAD_TTL_MINUTES, 60),
  downloadMaxCount: toPositiveInt(process.env.DOWNLOAD_MAX_COUNT, 3),
  cleanupIntervalMinutes: toPositiveInt(process.env.CLEANUP_INTERVAL_MINUTES, 15),
  maxConcurrentRequests: toPositiveInt(process.env.MAX_CONCURRENT_REQUESTS, 3),
};
