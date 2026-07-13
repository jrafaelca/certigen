<script setup>
import { computed } from 'vue'

const wizard = useWizardState()
const { request } = wizard
const { t, locale } = useI18n()

const statusLabels = {
  pending: 'common.status.pending',
  starting: 'common.status.starting',
  waiting_dns: 'common.status.waitingDns',
  checking_dns: 'common.status.checkingDns',
  issuing: 'common.status.issuing',
  packaging: 'common.status.packaging',
  ready: 'common.status.ready',
  failed: 'common.status.failed',
  cancelled: 'common.status.cancelled',
  expired: 'common.status.expired',
}

const requestDetails = computed(() => {
  if (!request.value) return []

  const prettyStatus = (status) => t(statusLabels[status] || 'common.status.pending')

  const formatDate = (value) => {
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

  return [
    [t('dns.details.domains'), request.value.domains?.join(', ') || t('common.noData')],
    [t('dns.details.certificateAuthority'), request.value.certificateAuthority === 'zerossl' ? t('request.form.authority.options.zerossl') : t('request.form.authority.options.letsencrypt')],
    [t('dns.details.status'), prettyStatus(request.value.status)],
    [t('dns.details.updated'), formatDate(request.value.updatedAt)],
  ]
})
</script>

<template>
  <div class="flex flex-col gap-4 overflow-hidden">
    <div class="grid gap-3 sm:grid-cols-3">
      <div
        v-for="[label, value] in requestDetails"
        :key="label"
        :class="label === t('dns.details.domains') ? 'sm:col-span-3' : ''"
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
          <h4 class="text-sm font-semibold">{{ t('common.actions.verify') }}</h4>
          <p class="text-xs text-muted">{{ t('dns.alerts.waitingTitle') }}</p>
        </div>
        <UBadge color="neutral" variant="subtle" size="sm">{{ t('common.actions.verify') }}</UBadge>
      </div>
      <pre class="m-0 max-h-64 overflow-auto bg-neutral-950/60 px-5 py-4 font-mono text-xs leading-6 text-neutral-300">{{ request?.recentLogs?.length ? request.recentLogs.join('\n') : t('common.noData') }}</pre>
    </UCard>
  </div>
</template>
