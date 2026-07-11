<script setup>
import { computed } from 'vue'

const props = defineProps({
  examples: {
    type: Object,
    required: true,
  },
  activeExample: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['update:activeExample'])

const currentExample = computed({
  get: () => props.activeExample,
  set: (value) => emit('update:activeExample', value),
})

const tabs = computed(() => [
  { label: 'Nginx', value: 'nginx' },
  { label: 'Apache', value: 'apache' },
  { label: 'HAProxy', value: 'haproxy' },
  { label: 'Node.js', value: 'nodejs' },
  { label: 'Docker', value: 'compose' },
])
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
    <div class="flex items-center justify-between gap-3">
      <h4 class="text-sm font-semibold">Installation examples</h4>
      <UTabs v-model="currentExample" :items="tabs" :content="false" />
    </div>

    <pre class="log-box min-h-0 flex-1 overflow-auto text-[10px] leading-5">{{ examples[currentExample] }}</pre>
  </div>
</template>
