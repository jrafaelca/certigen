<script setup>
import {computed, onBeforeUnmount, onMounted, ref, useTemplateRef} from 'vue'

const { public: { appName } } = useRuntimeConfig()

useHead({
  title: appName,
})

const wizard = useWizardState()
const requestForm = useTemplateRef('requestForm')
const currentStep = ref(1)
const stepperIndex = computed({
  get: () => currentStep.value - 1,
  set: (value) => {
    goToStep(Number(value) + 1)
  },
})
const activeStatuses = new Set(['pending', 'starting', 'waiting_dns', 'checking_dns', 'issuing', 'packaging'])

const steps = [
  {
    id: 1,
    label: 'Request',
    caption: 'Set up the request.',
    icon: 'i-lucide-clipboard-list',
  },
  {
    id: 2,
    label: 'DNS record',
    caption: 'Create and verify.',
    icon: 'i-lucide-globe',
  },
  {
    id: 3,
    label: 'Certificates',
    caption: 'Your generated bundle.',
    icon: 'i-lucide-download',
  },
]

const stepItems = computed(() =>
    steps.map((step) => ({
      value: step.id,
      title: step.label,
      description: step.caption,
      icon: step.icon,
      disabled: step.id !== currentStep.value || wizard.submitting.value,
    })),
)

const currentStepMeta = computed(() => steps[currentStep.value - 1] || steps[0])
const currentStepRequest = computed(() => wizard.request.value?.status || '')
const currentChallengeCount = computed(() => wizard.request.value?.challenges?.length || 0)
const isDnsRetryable = computed(() => ['failed', 'expired'].includes(currentStepRequest.value))
const requestLookupInProgress = ref(false)
const renewalModalOpen = ref(false)
const renewalModalRequest = ref(null)
const renewalModalPayload = ref(null)
const dnsVerifying = ref(false)
const requestRefreshTimer = ref(null)
const dnsRetryTimer = ref(null)
const dnsRetryStartedAt = ref(0)
const DNS_RETRY_DELAY_MS = 5000
const DNS_RETRY_TIMEOUT_MS = 60000
const dnsContinueLabel = computed(() => {
  if (currentStep.value === 1) return 'Create request'
  if (currentStep.value !== 2) return 'Continue'
  if (['issuing', 'packaging'].includes(currentStepRequest.value)) return 'Preparing bundle...'
  if (dnsVerifying.value) return isDnsRetryable.value ? 'Retrying...' : 'Checking DNS...'
  if (isDnsRetryable.value) return 'Retry'
  return 'Verify'
})
const dnsContinueDisabled = computed(() =>
  requestLookupInProgress.value
  || wizard.submitting.value
  || dnsVerifying.value
  || ['issuing', 'packaging'].includes(currentStepRequest.value))
const dnsContinueLoading = computed(() =>
  requestLookupInProgress.value
  || wizard.submitting.value
  || dnsVerifying.value
  || ['issuing', 'packaging'].includes(currentStepRequest.value))

const maxAccessibleStep = computed(() => {
  if (!wizard.requestId.value || !wizard.request.value) {
    return 1
  }

  const status = wizard.request.value.status
  if (wizard.request.value.downloadUuid || status === 'ready') {
    return 3
  }

  if (status === 'expired') {
    return 2
  }

  if (status === 'pending' || status === 'starting' || status === 'waiting_dns' || status === 'checking_dns' || status === 'issuing' || status === 'packaging' || status === 'failed') {
    return 2
  }

  return 2
})

if (!wizard.requestId.value) {
  wizard.resetWizardState()
} else if (wizard.request.value && activeStatuses.has(wizard.request.value.status)) {
  currentStep.value = stepFromStatus(wizard.request.value.status, wizard.request.value)
} else if (wizard.request.value) {
  wizard.resetWizardState()
} else {
  wizard.resetWizardUiState()
}

function setBanner(message, kind = 'info') {
  wizard.banner.value = {message, kind}
}

function buildRequestPayload() {
  return {
    email: wizard.email.value,
    domains: wizard.domains.value.join(','),
    wildcard: wizard.wildcard.value,
    certificateAuthority: wizard.certificateAuthority.value,
    resolvers: wizard.resolvers.value,
  }
}

function prefillWizardFromRequest(nextRequest) {
  wizard.email.value = nextRequest.email || ''
  wizard.domains.value = [nextRequest.primaryDomain, ...(nextRequest.additionalDomains || [])].filter(Boolean)
  wizard.wildcard.value = Boolean(nextRequest.wildcard)
  wizard.certificateAuthority.value = nextRequest.certificateAuthority || 'letsencrypt'
  wizard.resolvers.value = Array.isArray(nextRequest.resolvers) ? nextRequest.resolvers.join(', ') : 'system'
}

function goToStep(step) {
  if (step === currentStep.value) return
}

function isActiveRequest(request) {
  return Boolean(request?.requestId) && activeStatuses.has(request.status)
}

function renderRequest(nextRequest) {
  wizard.request.value = nextRequest

  const status = nextRequest.status
  const nextStep = Math.min(stepFromStatus(status, nextRequest), maxAccessibleStep.value)
  if (nextStep > currentStep.value) {
    currentStep.value = nextStep
  }

  const statusMessages = {
    ready: 'Certificate ready for download.',
  }

  wizard.banner.value = {
    kind: status === 'ready' ? 'success' : 'info',
    message: statusMessages[status] || '',
  }

  if (!shouldRefreshRequest()) {
    stopRequestRefresh()
  } else {
    startRequestRefresh()
  }
}

function stepFromStatus(status, request = null) {
  switch (status) {
    case 'pending':
    case 'starting':
    case 'waiting_dns':
    case 'checking_dns':
    case 'failed':
      return 2
    case 'issuing':
    case 'packaging':
      return 2
    case 'ready':
      return 3
    case 'expired':
      return request?.downloadUuid ? 3 : 2
    case 'cancelled':
      return 1
    default:
      return 1
  }
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'The operation could not be completed.')
  }

  return payload
}

async function refreshRequest() {
  if (!wizard.requestId.value) return
  const next = await api(`/api/requests/${wizard.requestId.value}`)
  renderRequest(next)
}

function shouldRefreshRequest() {
  return (
      Boolean(wizard.requestId.value)
      && (
          (
              currentStep.value === 2
              && (
                  (
                      ['pending', 'starting', 'waiting_dns'].includes(currentStepRequest.value)
                      && currentChallengeCount.value === 0
                  )
                  || ['issuing', 'packaging'].includes(currentStepRequest.value)
              )
          )
          || (
              currentStep.value === 3
              && ['issuing', 'packaging'].includes(currentStepRequest.value)
              && !wizard.request.value?.downloadUuid
          )
      )
  )
}

function stopRequestRefresh() {
  if (requestRefreshTimer.value) {
    clearInterval(requestRefreshTimer.value)
    requestRefreshTimer.value = null
  }
}

function stopDnsVerificationRetry() {
  if (dnsRetryTimer.value) {
    clearTimeout(dnsRetryTimer.value)
    dnsRetryTimer.value = null
  }

  dnsRetryStartedAt.value = 0
}

function startRequestRefresh() {
  if (!shouldRefreshRequest()) return
  if (requestRefreshTimer.value) return

  requestRefreshTimer.value = window.setInterval(async () => {
    if (!shouldRefreshRequest()) {
      stopRequestRefresh()
      return
    }

    try {
      await refreshRequest()
    } catch (error) {
      stopRequestRefresh()
      setBanner(error.message, 'error')
    }
  }, 2000)
}

function canRetryDns(nextStatus) {
  if (!dnsRetryStartedAt.value) return false

  const elapsed = Date.now() - dnsRetryStartedAt.value
  return elapsed < DNS_RETRY_TIMEOUT_MS && ['waiting_dns', 'failed'].includes(nextStatus)
}

function scheduleDnsRetry() {
  if (dnsRetryTimer.value) {
    clearTimeout(dnsRetryTimer.value)
  }

  dnsRetryTimer.value = window.setTimeout(() => {
    dnsRetryTimer.value = null

    if (currentStep.value !== 2 || !wizard.requestId.value) {
      stopDnsVerificationRetry()
      dnsVerifying.value = false
      return
    }

    void verifyAll({retry: true})
  }, DNS_RETRY_DELAY_MS)
}

async function submitRequest(payload = buildRequestPayload()) {
  try {
    wizard.submitting.value = true
    wizard.dnsVerificationAttempted.value = false
    const next = await api('/api/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    wizard.requestId.value = next.requestId
    wizard.request.value = next
    currentStep.value = 2
    await refreshRequest()
    startRequestRefresh()
  } catch (error) {
    setBanner(error.message, 'error')
  } finally {
    wizard.submitting.value = false
  }
}

async function handleCreateRequest() {
  if (!wizard.domains.value.length) {
    setBanner('Add at least one domain to create the request.', 'warning')
    return
  }

  if (!wizard.email.value) {
    setBanner('Add an email address to continue.', 'warning')
    return
  }

  const payload = buildRequestPayload()

  try {
    requestLookupInProgress.value = true
    const existing = await api('/api/requests/lookup', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    if (existing) {
      renewalModalRequest.value = existing
      renewalModalPayload.value = payload
      renewalModalOpen.value = true
      return
    }

    await submitRequest(payload)
  } catch (error) {
    setBanner(error.message, 'error')
  } finally {
    requestLookupInProgress.value = false
  }
}

function resetCurrentRequest() {
  stopRequestRefresh()
  stopDnsVerificationRetry()
  dnsVerifying.value = false
  wizard.dnsVerificationAttempted.value = false
  wizard.requestId.value = ''
  wizard.request.value = null
  wizard.banner.value = {message: '', kind: 'info'}
  currentStep.value = 1
}

function closeRenewalModal() {
  renewalModalOpen.value = false
  renewalModalRequest.value = null
  renewalModalPayload.value = null
}

function continueWithExistingCertificate() {
  if (!renewalModalRequest.value) return

  const next = renewalModalRequest.value
  prefillWizardFromRequest(next)
  closeRenewalModal()
  stopRequestRefresh()
  stopDnsVerificationRetry()
  dnsVerifying.value = false
  wizard.dnsVerificationAttempted.value = false
  wizard.requestId.value = next.requestId
  renderRequest(next)
  currentStep.value = 3
}

async function renewWithNewRequest() {
  const sourceRequest = renewalModalRequest.value
  const payload = renewalModalPayload.value || buildRequestPayload()
  if (sourceRequest) {
    prefillWizardFromRequest(sourceRequest)
  }
  closeRenewalModal()
  stopRequestRefresh()
  stopDnsVerificationRetry()
  dnsVerifying.value = false
  wizard.dnsVerificationAttempted.value = false
  wizard.requestId.value = ''
  wizard.request.value = null
  wizard.banner.value = {message: '', kind: 'info'}
  currentStep.value = 1
  await submitRequest(payload)
}

async function verifyAll({retry = false} = {}) {
  if (!wizard.requestId.value) return

  if (!retry) {
    stopDnsVerificationRetry()
    dnsRetryStartedAt.value = Date.now()
    dnsVerifying.value = true
    wizard.dnsVerificationAttempted.value = false
  }

  try {
    const next = await api(`/api/requests/${wizard.requestId.value}/verify`, {method: 'POST'})
    renderRequest(next)
    if (next.status === 'ready') {
      stopDnsVerificationRetry()
      wizard.dnsVerificationAttempted.value = false
      currentStep.value = 3
      dnsVerifying.value = false
      return next
    }

    if (['issuing', 'packaging'].includes(next.status)) {
      stopDnsVerificationRetry()
      wizard.dnsVerificationAttempted.value = false
      currentStep.value = 2
      dnsVerifying.value = false
      return next
    }

    if (canRetryDns(next.status)) {
      wizard.dnsVerificationAttempted.value = true
      dnsVerifying.value = true
      scheduleDnsRetry()
      return next
    }

    wizard.dnsVerificationAttempted.value = ['waiting_dns', 'failed'].includes(next.status)
    stopDnsVerificationRetry()
    return next
  } catch (error) {
    stopDnsVerificationRetry()
    wizard.dnsVerificationAttempted.value = retry
    setBanner(error.message, 'error')
    throw error
  } finally {
    if (!dnsRetryTimer.value) {
      dnsVerifying.value = false
    }
  }
}

async function onStepperNext() {
  if (currentStep.value === 1 && !wizard.requestId.value) {
    await requestForm.value?.validateAndSubmit()
    return
  }

  if (currentStep.value === 2) {
    if (isDnsRetryable.value) {
      await submitRequest()
      return
    }

    if (dnsContinueDisabled.value) return
    await verifyAll()
    return
  }
}

async function hydrateWizardState() {
  if (!wizard.requestId.value) {
    return
  }

  if (wizard.request.value && isActiveRequest(wizard.request.value)) {
    currentStep.value = stepFromStatus(wizard.request.value.status, wizard.request.value)
    startRequestRefresh()
    return
  }

  try {
    const next = await api(`/api/requests/${wizard.requestId.value}`)

    if (!isActiveRequest(next)) {
      stopDnsVerificationRetry()
      wizard.resetWizardState()
      currentStep.value = 1
      return
    }

    wizard.request.value = next
    currentStep.value = stepFromStatus(next.status, next)
    wizard.banner.value = {message: '', kind: 'info'}
    startRequestRefresh()
  } catch {
    stopDnsVerificationRetry()
    wizard.resetWizardState()
    currentStep.value = 1
  }
}

onMounted(() => {
  hydrateWizardState()
})

onBeforeUnmount(() => {
  stopRequestRefresh()
  stopDnsVerificationRetry()
})

function onStepChange(step) {
  goToStep(Number(step) + 1)
}

const downloadButtonLabel = computed(() => {
  if (wizard.request.value?.downloadUuid) {
    return 'Download ZIP'
  }

  if (['issuing', 'packaging'].includes(currentStepRequest.value)) {
    return 'Preparing bundle...'
  }

  return 'Download ZIP'
})

const downloadButtonDisabled = computed(() => !wizard.request.value?.downloadUuid)

function downloadCurrentBundle() {
  const downloadUuid = wizard.request.value?.downloadUuid
  if (!downloadUuid) return

  window.location.href = `/api/download/${downloadUuid}`
}
</script>

<template>
  <UPage>
    <UPageBody>
      <div class="mx-auto max-w-xl">
        <UStepper
            size="sm"
            :model-value="stepperIndex"
            :items="stepItems"
            :linear="false"
            class="mb-6"
            @update:model-value="onStepChange"
        />

        <UCard>
          <div class="flex flex-col gap-5">
            <div class="space-y-1">
              <h3 class="text-lg font-semibold">{{ currentStepMeta.label }}</h3>
              <p class="text-sm text-muted">{{ currentStepMeta.caption }}</p>
            </div>

            <WizardBanner
                v-if="wizard.banner.value.message && currentStep !== 3"
                :kind="wizard.banner.value.kind"
                :message="wizard.banner.value.message"
            />

            <WizardRequestForm
                v-if="currentStep === 1"
                ref="requestForm"
                @submit="handleCreateRequest"
            />

            <WizardDnsChallengeStep
                v-else-if="currentStep === 2"
                :is-verifying="dnsVerifying"
            />

            <WizardDownloadStep
                v-else
            />
          </div>

          <template #footer>
            <div class="flex items-center gap-3">
              <UButton
                  v-if="currentStep === 2"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-arrow-left"
                  @click="resetCurrentRequest"
              >
                Back
              </UButton>
              <UButton
                  v-if="currentStep === 3"
                  color="primary"
                  icon="i-lucide-download"
                  :disabled="downloadButtonDisabled || wizard.submitting.value"
                  class="ml-auto"
                  @click="downloadCurrentBundle"
              >
                {{ downloadButtonLabel }}
              </UButton>
              <UButton
                  v-if="currentStep !== 3"
                  color="primary"
                  :icon="currentStep === 1 ? 'i-lucide-play' : isDnsRetryable ? 'i-lucide-refresh-cw' : 'i-lucide-shield-check'"
                  :trailing="currentStep !== 1"
                  :trailing-icon="currentStep !== 1 ? 'i-lucide-arrow-right' : undefined"
                  :disabled="dnsContinueDisabled"
                  :loading="currentStep === 2 && dnsContinueLoading"
                  class="ml-auto"
                  @click="onStepperNext"
              >
                {{ dnsContinueLabel }}
              </UButton>
            </div>
          </template>
        </UCard>
      </div>
    </UPageBody>

    <UModal v-model:open="renewalModalOpen">
      <UCard :ui="{ body: 'space-y-4', footer: 'justify-end gap-3' }">
        <div class="space-y-1">
          <h3 class="text-base font-semibold">Certificate already exists</h3>
          <p class="text-sm text-muted">
            We found a valid certificate for the same domain set. You can keep it or create a new request.
          </p>
        </div>

        <div class="grid gap-3 text-sm">
          <div>
            <p class="text-xs font-medium uppercase tracking-wide text-muted">Domains</p>
            <p class="mt-1 break-words font-medium">
              {{ renewalModalRequest?.domains?.join(', ') || '-' }}
            </p>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted">Status</p>
              <p class="mt-1 font-medium">Ready</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted">Updated</p>
              <p class="mt-1 font-medium">
                {{ renewalModalRequest?.updatedAt ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(renewalModalRequest.updatedAt)) : '-' }}
              </p>
            </div>
          </div>
        </div>

        <template #footer>
          <UButton color="neutral" variant="soft" @click="closeRenewalModal">
            Cancel
          </UButton>
          <UButton color="neutral" variant="soft" icon="i-lucide-download" @click="continueWithExistingCertificate">
            Download existing
          </UButton>
          <UButton color="primary" icon="i-lucide-refresh-cw" @click="renewWithNewRequest">
            Renew
          </UButton>
        </template>
      </UCard>
    </UModal>
  </UPage>
</template>
