<script setup>
import { computed, useTemplateRef } from 'vue'
import { z } from 'zod'

const { email, domains, wildcard, certificateAuthority } = useWizardState()
const wizard = useWizardState()
const form = useTemplateRef('form')
const emit = defineEmits(['submit'])

const domainPattern = /^(?:\*\.)?(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
const schema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  certificateAuthority: z.literal('letsencrypt', { error: 'Select a supported certificate authority.' }),
  domains: z.array(z.string().trim().regex(domainPattern, 'Enter valid domain names.')).min(1, 'Add at least one domain.'),
  wildcard: z.boolean(),
})

const formState = computed(() => ({
  email: email.value,
  certificateAuthority: certificateAuthority.value,
  domains: domains.value,
  wildcard: wildcard.value,
}))

async function validateAndSubmit() {
  try {
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
      <UFormField name="email" label="Email address" help="Used for ACME account notices.">
        <UInput v-model="email" class="w-full" type="email" placeholder="you@your-domain.com" />
      </UFormField>

      <UFormField name="certificateAuthority" label="Certificate authority">
        <USelect
          v-model="certificateAuthority"
          class="w-full"
          :options="[
            { label: 'Let’s Encrypt', value: 'letsencrypt' },
            { label: 'ZeroSSL', value: 'zerossl' },
          ]"
        />
      </UFormField>

      <UFormField class="lg:col-span-2" name="domains" label="Domains" help="Enter a domain and press Enter or comma. The first one becomes primary.">
        <UInputTags
          v-model="domains"
          class="w-full"
          placeholder="example.com, www.example.com"
          icon="i-lucide-globe"
          variant="outline"
          size="md"
        />
      </UFormField>

      <UFormField class="lg:col-span-2" name="wildcard">
        <UCheckbox v-model="wildcard" label="Include wildcard coverage" />
      </UFormField>
    </div>
  </UForm>
</template>
