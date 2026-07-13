<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  isVerifying: {
    type: Boolean,
    default: false,
  },
})

const wizard = useWizardState()
const { request } = wizard
const { t, locale } = useI18n()

const requestStatus = computed(() => request.value?.status || 'pending')
const challengeCount = computed(() => request.value?.challenges?.length || 0)
const isPreparing = computed(() => ['pending', 'starting'].includes(requestStatus.value) && challengeCount.value === 0)
const dnsRecordHasError = computed(() =>
  !props.isVerifying && wizard.dnsVerificationAttempted.value && ['waiting_dns', 'failed'].includes(requestStatus.value),
)
const dnsRecordError = computed(() => {
  if (!dnsRecordHasError.value) return ''

  return request.value?.error || request.value?.message || t('dns.alerts.notVisibleYet')
})

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

function prettyStatus(status) {
  return t(statusLabels[status] || 'common.status.pending')
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

function formatCountdown(value) {
  if (value === null) return t('common.noData')
  const minutes = Math.floor(value / 60)
  const seconds = String(value % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

const requestDetails = computed(() => {
  if (!request.value) return []

  const expiresLabel = () => {
    if (request.value.status === 'waiting_dns' && secondsRemaining.value === 0) {
      return t('common.status.retryRequired')
    }

    return secondsRemaining.value === null ? t('common.noData') : formatCountdown(secondsRemaining.value)
  }

  return [
    { label: t('dns.details.domains'), value: request.value.domains?.join(', ') || t('common.noData'), span: 'sm:col-span-2' },
    { label: t('dns.details.expiresIn'), value: expiresLabel(), badge: true, span: 'sm:col-span-1' },
    {
      label: t('dns.details.certificateAuthority'),
      value: request.value.certificateAuthority === 'zerossl'
        ? t('request.form.authority.options.zerossl')
        : t('request.form.authority.options.letsencrypt'),
      span: 'sm:col-span-1',
    },
    { label: t('dns.details.status'), value: prettyStatus(request.value.status), span: 'sm:col-span-1' },
    { label: t('dns.details.updated'), value: formatDate(request.value.updatedAt), span: 'sm:col-span-1' },
  ]
})

const { copy, copied } = useClipboard()
const copiedField = ref('')
const now = ref(Date.now())
let countdownTimer

const expiresAt = computed(() => {
  if (['failed', 'cancelled', 'ready'].includes(requestStatus.value)) {
    return null
  }

  const timestamps = (request.value?.challenges || [])
    .map((challenge) => {
      if (challenge.expiresAt) return new Date(challenge.expiresAt).getTime()
      if (challenge.createdAt) return new Date(challenge.createdAt).getTime() + 10 * 60 * 1000
      return null
    })
    .filter((value) => Number.isFinite(value))

  const challengeExpiry = timestamps.length ? Math.min(...timestamps) : null
  const requestCreatedAt = request.value?.createdAt ? new Date(request.value.createdAt).getTime() + 10 * 60 * 1000 : null

  if (challengeExpiry && challengeExpiry > Date.now()) {
    return challengeExpiry
  }

  if (requestCreatedAt && ['pending', 'starting', 'waiting_dns', 'checking_dns', 'issuing', 'packaging'].includes(requestStatus.value)) {
    return requestCreatedAt
  }

  return challengeExpiry || requestCreatedAt
})

const secondsRemaining = computed(() => {
  if (!expiresAt.value) return null
  return Math.max(0, Math.ceil((expiresAt.value - now.value) / 1000))
})

async function copyChallengeValue(value, field) {
  await copy(value)
  copiedField.value = field
}

onMounted(() => {
  countdownTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  clearInterval(countdownTimer)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid gap-3 sm:grid-cols-3">
      <div v-for="item in requestDetails" :key="item.label" :class="item.span">
        <p class="text-xs font-medium uppercase tracking-wide text-muted">{{ item.label }}</p>
        <UBadge
          v-if="item.badge"
          color="warning"
          variant="subtle"
          size="sm"
          icon="i-lucide-clock-3"
          class="mt-1 inline-flex"
        >
          {{ item.value }}
        </UBadge>
        <p v-else class="mt-1 break-words text-sm font-medium">{{ item.value }}</p>
      </div>
    </div>

    <USeparator />

    <div v-if="isPreparing" class="grid gap-3">
      <div class="grid gap-2">
        <USkeleton class="h-4 w-28" />
        <USkeleton class="h-10 w-full" />
      </div>
      <div class="grid gap-2">
        <USkeleton class="h-4 w-36" />
        <USkeleton class="h-10 w-full" />
      </div>
    </div>

    <div v-else class="grid gap-3 overflow-auto pr-1">
      <UAlert
        v-if="dnsRecordHasError"
        :title="dnsRecordError"
        icon="i-lucide-circle-alert"
        color="error"
        variant="subtle"
        size="sm"
      />

      <div v-for="challenge in request?.challenges || []" :key="challenge.id" class="grid gap-3">
        <div class="grid gap-2">
          <UFormField
            :label="t('dns.record.name')"
            :ui="{ label: 'text-xs font-medium uppercase tracking-wide text-muted' }"
          >
            <UInput
              :model-value="challenge.recordName"
              readonly
              class="w-full"
              :ui="{ trailing: 'pr-0.5' }"
              :color="dnsRecordHasError ? 'error' : 'neutral'"
            >
              <template #trailing>
                <UTooltip :text="t('dns.record.copy')" :content="{ side: 'right' }">
                  <UButton
                    :color="copied && copiedField === `${challenge.id}-name` ? 'success' : 'neutral'"
                    variant="link"
                    size="sm"
                    :icon="copied && copiedField === `${challenge.id}-name` ? 'i-lucide-copy-check' : 'i-lucide-copy'"
                    :aria-label="t('dns.record.copyName')"
                    @click="copyChallengeValue(challenge.recordName, `${challenge.id}-name`)"
                  />
                </UTooltip>
              </template>
            </UInput>
          </UFormField>

          <UFormField
            :label="t('dns.record.value')"
            :ui="{ label: 'text-xs font-medium uppercase tracking-wide text-muted' }"
          >
            <UInput
              :model-value="challenge.recordValue"
              readonly
              class="w-full"
              :ui="{ trailing: 'pr-0.5' }"
              :color="dnsRecordHasError ? 'error' : 'neutral'"
            >
              <template #trailing>
                <UTooltip :text="t('dns.record.copy')" :content="{ side: 'right' }">
                  <UButton
                    :color="copied && copiedField === `${challenge.id}-value` ? 'success' : 'neutral'"
                    variant="link"
                    size="sm"
                    :icon="copied && copiedField === `${challenge.id}-value` ? 'i-lucide-copy-check' : 'i-lucide-copy'"
                    :aria-label="t('dns.record.copyValue')"
                    @click="copyChallengeValue(challenge.recordValue, `${challenge.id}-value`)"
                  />
                </UTooltip>
              </template>
            </UInput>
          </UFormField>
        </div>
      </div>
    </div>
  </div>
</template>
