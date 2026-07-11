<script setup>
const { wildcard, certificateAuthority, resolvers } = useWizardState()

const items = [
  {
    label: 'Advanced options',
    value: 'advanced',
    slot: 'advanced',
  },
]
</script>

<template>
  <UAccordion :items="items">
    <template #advanced-body>
      <div class="grid gap-4 lg:grid-cols-2">
        <UCheckbox v-model="wildcard" label="Wildcard" />

        <UFormField label="Certificate authority">
          <USelect
            v-model="certificateAuthority"
            class="w-full"
            :options="[
              { label: 'Let’s Encrypt', value: 'letsencrypt' },
              { label: 'ZeroSSL', value: 'zerossl' },
            ]"
          />
        </UFormField>

        <UFormField class="lg:col-span-2" label="DNS resolvers" help="Leave the default system resolver unless you need to avoid local caching.">
          <UInput v-model="resolvers" class="w-full" placeholder="system, 1.1.1.1, 8.8.8.8" />
        </UFormField>
      </div>
    </template>
  </UAccordion>
</template>
