import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { version } = require('./package.json')

export default defineNuxtConfig({
  ssr: false,
  modules: ['@nuxt/ui', '@nuxtjs/i18n'],
  css: ['~/assets/css/main.css'],
  i18n: {
    strategy: 'prefix_except_default',
    defaultLocale: 'en',
    detectBrowserLanguage: false,
    locales: [
      { code: 'en', name: 'English', language: 'en' },
      { code: 'es', name: 'Español', language: 'es' },
    ],
    vueI18n: './i18n.config.ts',
  },
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
    dataDir: '/data',
    version,
    requestTtlMinutes: process.env.REQUEST_TTL_MINUTES || '60',
    downloadTtlMinutes: process.env.DOWNLOAD_TTL_MINUTES || '60',
    downloadMaxCount: process.env.DOWNLOAD_MAX_COUNT || '1',
    cleanupIntervalMinutes: process.env.CLEANUP_INTERVAL_MINUTES || '15',
    maxConcurrentRequests: process.env.MAX_CONCURRENT_REQUESTS || '3',
    public: {
      appName: process.env.APP_NAME || 'Certigen',
    },
  },
})
