<script setup>
import { computed } from 'vue'

const wizard = useWizardState()
const { request } = wizard

const requestDetails = computed(() => {
  if (!request.value) return []

  const prettyStatus = (status) => {
    const labels = {
      pending: 'Pending',
      starting: 'Starting',
      waiting_dns: 'Waiting for DNS',
      checking_dns: 'Checking DNS',
      issuing: 'Issuing',
      packaging: 'Packaging',
      ready: 'Ready',
      failed: 'Failed',
      cancelled: 'Cancelled',
      expired: 'Expired',
    }

    return labels[status] || status
  }

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
    ['Domains', request.value.domains?.join(', ') || '-'],
    ['CA', request.value.certificateAuthority === 'zerossl' ? 'ZeroSSL' : "Let's Encrypt"],
    ['Status', prettyStatus(request.value.status)],
    ['Updated', formatDate(request.value.updatedAt)],
  ]
})

</script>

<template>
  <div class="flex flex-col gap-4 overflow-hidden">
    <div class="grid gap-3 sm:grid-cols-3">
      <div
        v-for="[label, value] in requestDetails"
        :key="label"
        :class="label === 'Domains' ? 'sm:col-span-3' : ''"
      >
        <p class="text-xs font-medium uppercase tracking-wide text-muted">{{ label }}</p>
        <p class="mt-1 break-words text-sm font-medium">{{ value }}</p>
      </div>
    </div>

    <UCard
      class="-mx-5 -mb-5 overflow-hidden rounded-t-none"
      :ui="{ body: 'p-0' }"
    >
      <div class="flex items-center justify-between border-b border-default bg-neutral-950/30 px-5 py-3">
        <div>
          <h4 class="text-sm font-semibold">Log</h4>
          <p class="text-xs text-muted">Live Certbot log</p>
        </div>
        <UBadge color="neutral" variant="subtle" size="sm">Live polling</UBadge>
      </div>
      <pre class="m-0 max-h-64 overflow-auto bg-neutral-950/60 px-5 py-4 font-mono text-xs leading-6 text-neutral-300">{{ request?.recentLogs?.length ? request.recentLogs.join('\n') : 'No activity yet.' }}</pre>
    </UCard>
  </div>
</template>
