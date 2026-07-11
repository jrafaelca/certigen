<script setup>
import { computed } from 'vue'
import { useClipboard } from '@vueuse/core'

const wizard = useWizardState()
const { request, activeExample } = wizard
const { copy, copied } = useClipboard()

const tabs = [
  { label: 'Nginx', value: 'nginx' },
  { label: 'Apache', value: 'apache' },
  { label: 'HAProxy', value: 'haproxy' },
  { label: 'Node.js', value: 'nodejs' },
  { label: 'Docker', value: 'compose' },
]

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

const bundleDetails = computed(() => {
  if (!request.value) return []

  const formatDate = (value) => {
    if (!value) return '-'

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return value
    }

    return new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  }

  return [
    { label: 'Issued at', value: formatDate(request.value.issuedAt), span: 'sm:col-span-1' },
    { label: 'Expires at', value: formatDate(request.value.expiresAt), span: 'sm:col-span-1' },
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
      <div class="sm:col-span-2">
        <p class="text-xs font-medium uppercase tracking-wide text-muted">SHA-256 fingerprint</p>
        <p class="mt-1 break-words text-sm font-medium">{{ request?.fingerprintSha256 || '-' }}</p>
      </div>
    </div>

    <USeparator />

    <div class="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div class="flex flex-col gap-1">
        <h4 class="text-sm font-semibold">Installation examples</h4>
        <p class="text-xs text-muted">Use the snippet that matches your stack.</p>
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
          @click="copyExample"
        >
        </UButton>
        <pre class="min-h-0 overflow-auto px-4 py-3 font-mono text-[10px] leading-5 text-neutral-300">{{ currentExample }}</pre>
      </div>
    </div>
  </div>
</template>
