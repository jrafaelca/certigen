<script setup>
import { computed } from 'vue'

const wizard = useWizardState()
const { request, activeExample } = wizard
const { t, locale } = useI18n()
const { copy, copied } = useClipboard()

const tabs = computed(() => [
  { label: t('certificates.examples.tabs.nginx'), value: 'nginx' },
  { label: t('certificates.examples.tabs.apache'), value: 'apache' },
  { label: t('certificates.examples.tabs.haproxy'), value: 'haproxy' },
  { label: t('certificates.examples.tabs.nodejs'), value: 'nodejs' },
  { label: t('certificates.examples.tabs.docker'), value: 'compose' },
])

const examples = {
  nginx: `server {
  listen 443 ssl;
  server_name example.com;

  ssl_certificate /etc/nginx/certs/example.com/fullchain.pem;
  ssl_certificate_key /etc/nginx/certs/example.com/private-key.pem;
}`,
  apache: `<VirtualHost *:443>
  ServerName example.com

  SSLEngine on
  SSLCertificateFile /etc/apache2/certs/example.com/fullchain.pem
  SSLCertificateKeyFile /etc/apache2/certs/example.com/private-key.pem
</VirtualHost>`,
  haproxy: `cat fullchain.pem private-key.pem > example.com.pem

frontend https
  bind *:443 ssl crt /etc/haproxy/certs/example.com.pem
  default_backend app`,
  nodejs: `import fs from 'node:fs'
import https from 'node:https'

const server = https.createServer({
  cert: fs.readFileSync('/certs/fullchain.pem'),
  key: fs.readFileSync('/certs/private-key.pem')
})`,
  compose: `services:
  nginx:
    image: nginx:alpine
    volumes:
      - ./certificates/fullchain.pem:/etc/nginx/certs/fullchain.pem:ro
      - ./certificates/private-key.pem:/etc/nginx/certs/private-key.pem:ro`,
}

function formatDate(value) {
  if (!value) return t('common.noData')

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const bundleDetails = computed(() => {
  if (!request.value) return []

  return [
    { label: t('certificates.details.issuedAt'), value: formatDate(request.value.issuedAt), span: 'sm:col-span-1' },
    { label: t('certificates.details.expiresAt'), value: formatDate(request.value.expiresAt), span: 'sm:col-span-1' },
    { label: t('certificates.details.sha256Fingerprint'), value: request.value.fingerprintSha256 || t('common.noData'), span: 'sm:col-span-2' },
  ]
})

const currentExample = computed(() => examples[activeExample.value] || '')

async function copyExample() {
  await copy(currentExample.value)
}
</script>

<template>
  <div class="flex flex-col gap-4 overflow-hidden">
    <div class="grid gap-3 sm:grid-cols-2">
      <div v-for="item in bundleDetails" :key="item.label" :class="item.span">
        <p class="text-xs font-medium uppercase tracking-wide text-muted">{{ item.label }}</p>
        <p class="mt-1 break-words text-sm font-medium">{{ item.value }}</p>
      </div>
    </div>

    <USeparator />

    <div class="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div class="flex flex-col gap-1">
        <h4 class="text-sm font-semibold">{{ t('certificates.examples.title') }}</h4>
        <p class="text-xs text-muted">{{ t('certificates.examples.description') }}</p>
      </div>

      <UTabs
        v-model="activeExample"
        :items="tabs"
        :content="false"
        size="xs"
        class="text-xs"
      />

      <div class="group relative rounded-xl border border-default bg-neutral-950/60">
        <UButton
          class="absolute right-3 top-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          color="neutral"
          variant="soft"
          size="xs"
          :icon="copied ? 'i-lucide-copy-check' : 'i-lucide-copy'"
          :aria-label="t('certificates.actions.copySnippet')"
          @click="copyExample"
        />
        <pre class="m-0 max-h-80 overflow-auto px-4 py-3 font-mono text-[11px] leading-5 text-neutral-300">{{ currentExample }}</pre>
      </div>
    </div>
  </div>
</template>
