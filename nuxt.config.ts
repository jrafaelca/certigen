import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { version } = require('./package.json')

export default defineNuxtConfig({
  ssr: false,
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: process.env.APP_NAME || 'Certigen',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Generate TLS certificates with manual DNS validation.' },
      ],
    },
  },
  runtimeConfig: {
    dataDir: process.env.DATA_DIR || '/data',
    port: process.env.PORT || '3000',
    appHost: process.env.APP_HOST || '0.0.0.0',
    version,
    requestTtlMinutes: process.env.REQUEST_TTL_MINUTES || '60',
    downloadTtlMinutes: process.env.DOWNLOAD_TTL_MINUTES || '60',
    downloadMaxCount: process.env.DOWNLOAD_MAX_COUNT || '3',
    cleanupIntervalMinutes: process.env.CLEANUP_INTERVAL_MINUTES || '15',
    maxConcurrentRequests: process.env.MAX_CONCURRENT_REQUESTS || '3',
    public: {
      appName: process.env.APP_NAME || 'Certigen',
    },
  },
})
