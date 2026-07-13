<script setup>
const { t } = useI18n()
const { wildcard, certificateAuthority, resolvers } = useWizardState()

const items = [
  {
    label: t('request.form.advanced.title'),
    value: 'advanced',
    slot: 'advanced',
  },
]
</script>

<template>
  <UAccordion :items="items">
    <template #advanced-body>
      <div class="grid gap-4 lg:grid-cols-2">
        <UCheckbox v-model="wildcard" :label="t('request.form.advanced.wildcard')" />

        <UFormField :label="t('request.form.advanced.authority')">
          <USelect
            v-model="certificateAuthority"
            class="w-full"
            :options="[
              { label: t('request.form.authority.options.letsencrypt'), value: 'letsencrypt' },
              { label: t('request.form.authority.options.zerossl'), value: 'zerossl' },
            ]"
          />
        </UFormField>

        <UFormField class="lg:col-span-2" :label="t('request.form.advanced.resolvers')" :help="t('request.form.advanced.resolversHint')">
          <UInput v-model="resolvers" class="w-full" :placeholder="t('request.form.advanced.resolversPlaceholder')" />
        </UFormField>
      </div>
    </template>
  </UAccordion>
</template>
