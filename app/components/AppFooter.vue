<script setup lang="ts">
import type {NavigationMenuItem} from '@nuxt/ui'
import { computed } from 'vue'

const { t } = useI18n()

const items = computed<NavigationMenuItem[]>(() => [
  {
    label: t('footer.certbot'),
    to: 'https://certbot.eff.org/',
    target: '_blank',
  },
])
</script>

<template>
  <UFooter>
    <template #left>
      <p class="text-muted text-sm">{{ t('footer.copyright', { year: new Date().getFullYear() }) }}</p>
    </template>

    <UNavigationMenu :items="items" variant="link"/>

    <template #right>
      <UButton
          icon="i-simple-icons-github"
          color="neutral"
          variant="ghost"
          to="https://github.com/jrafaelca/certigen"
          target="_blank"
          :aria-label="t('header.github')"
      />
    </template>
  </UFooter>
</template>
