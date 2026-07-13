<script setup>
import { computed, ref, watch, useTemplateRef } from 'vue'
import { z } from 'zod'

const { email, domains, wildcard, certificateAuthority } = useWizardState()
const wizard = useWizardState()
const form = useTemplateRef('form')
const emit = defineEmits(['submit'])
const { t } = useI18n()

const domainPattern = /^(?:\*\.)?(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
const domainsInput = ref('')

function parseDomainInput(value) {
  return String(value ?? '')
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean)
}

const schema = computed(() => z.object({
  email: z.string().trim().email(t('request.form.validation.email')),
  certificateAuthority: z.literal('letsencrypt', { error: t('request.form.validation.authority') }),
  domains: z.array(z.string().trim().regex(domainPattern, t('request.form.validation.domains'))).min(1, t('request.form.validation.atLeastOne')),
  wildcard: z.boolean(),
}))

const formState = computed(() => ({
  email: email.value,
  certificateAuthority: certificateAuthority.value,
  domains: domains.value,
  wildcard: wildcard.value,
}))

watch(
  domains,
  (nextDomains) => {
    const nextValue = Array.isArray(nextDomains) ? nextDomains.join(', ') : ''
    if (nextValue !== domainsInput.value) {
      domainsInput.value = nextValue
    }
  },
  { immediate: true },
)

function syncDomainsInput(value) {
  domains.value = parseDomainInput(value?.value ?? value)
}

async function validateAndSubmit() {
  try {
    domains.value = parseDomainInput(domainsInput.value)
    await form.value?.validate({ transform: false })
    emit('submit')
    return true
  } catch {
    return false
  }
}

defineExpose({ validateAndSubmit })
</script>

<template>
  <UForm ref="form" :schema="schema" :state="formState" :validate-on="['blur', 'change']">
    <div class="grid gap-4 lg:grid-cols-2">
      <UFormField name="email" :label="t('request.form.email.label')" :help="t('request.form.email.hint')">
        <UInput
          v-model="email"
          class="w-full"
          type="email"
          :placeholder="t('request.form.email.placeholder', { at: '@' })"
        />
      </UFormField>

      <UFormField name="certificateAuthority" :label="t('request.form.authority.label')">
        <USelect
          v-model="certificateAuthority"
          class="w-full"
          :options="[
            { label: t('request.form.authority.options.letsencrypt'), value: 'letsencrypt' },
            { label: t('request.form.authority.options.zerossl'), value: 'zerossl' },
          ]"
        />
      </UFormField>

      <UFormField class="lg:col-span-2" name="domains" :label="t('request.form.domains.label')" :help="t('request.form.domains.hint')">
        <UInput
          v-model="domainsInput"
          class="w-full"
          :placeholder="t('request.form.domains.placeholder')"
          icon="i-lucide-globe"
          variant="outline"
          size="md"
          @blur="syncDomainsInput(domainsInput)"
        />
      </UFormField>

      <UFormField class="lg:col-span-2" name="wildcard">
        <UCheckbox v-model="wildcard" :label="t('request.form.wildcard.label')" />
      </UFormField>
    </div>
  </UForm>
</template>
