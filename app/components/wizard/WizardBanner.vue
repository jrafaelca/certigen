<script setup>
defineProps({
  kind: {
    type: String,
    default: 'info',
  },
  message: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <UAlert
    v-if="message"
    :color="kind === 'error' ? 'error' : kind === 'warning' ? 'warning' : kind === 'success' ? 'success' : kind === 'neutral' ? 'neutral' : 'primary'"
    :icon="kind === 'error' ? 'i-lucide-circle-alert' : kind === 'warning' ? 'i-lucide-triangle-alert' : kind === 'success' ? 'i-lucide-circle-check' : 'i-lucide-info'"
    :title="message"
    variant="subtle"
    size="sm"
  />
</template>
