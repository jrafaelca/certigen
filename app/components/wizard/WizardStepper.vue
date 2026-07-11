<script setup>
import { computed } from 'vue'

const props = defineProps({
  steps: {
    type: Array,
    required: true,
  },
  modelValue: {
    type: Number,
    required: true,
  },
  maxAccessibleStep: {
    type: Number,
    required: true,
  },
  submitting: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const stepItems = computed(() =>
  props.steps.map((step) => ({
    value: step.id,
    title: step.label,
    description: step.caption,
    icon: step.icon,
    disabled: step.id > props.maxAccessibleStep || props.submitting,
  })),
)

const currentStep = computed({
  get: () => Number(props.modelValue) - 1,
  set: (value) => emit('update:modelValue', Number(value) + 1),
})
</script>

<template>
  <UStepper v-model="currentStep" :items="stepItems" />
</template>
