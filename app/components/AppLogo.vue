<script setup lang="ts">
const { public: { appName } } = useRuntimeConfig()
</script>

<template>
  <NuxtLink to="/" class="inline-flex items-center gap-2 font-semibold dark:text-white">
    <span class="inline-flex size-7 items-center justify-center rounded-full bg-primary">
      <UIcon name="i-lucide-globe-lock" class="size-4 text-white" />
    </span>
    <span>{{ appName }}</span>
  </NuxtLink>
</template>
