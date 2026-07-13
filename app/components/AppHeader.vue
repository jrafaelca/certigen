<template>
  <UHeader>
    <template #title>
      <AppLogo/>
    </template>

    <template #right>
      <div class="flex items-center gap-2">
        <UDropdownMenu :items="localeItems" :content="{ align: 'end', sideOffset: 8 }">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-languages"
            :aria-label="t('header.language')"
          />
        </UDropdownMenu>
        <UColorModeButton />
      </div>

      <UTooltip :text="t('header.github')">
        <UButton
          color="neutral"
          variant="ghost"
          to="https://github.com/jrafaelca/certigen"
          target="_blank"
          icon="i-simple-icons-github"
          :aria-label="t('header.github')"
        />
      </UTooltip>
    </template>
  </UHeader>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const { t, locale, setLocale } = useI18n()

const currentLocale = computed({
  get: () => locale.value,
  set: (value) => {
    void setLocale(value)
  },
})

const localeItems = computed(() => ([
  {
    label: t('header.locales.en'),
    description: 'EN',
    checked: currentLocale.value === 'en',
    onSelect: () => {
      currentLocale.value = 'en'
    },
  },
  {
    label: t('header.locales.es'),
    description: 'ES',
    checked: currentLocale.value === 'es',
    onSelect: () => {
      currentLocale.value = 'es'
    },
  },
]))
</script>
