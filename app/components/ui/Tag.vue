<script setup lang="ts">
// Small mono label in caps (design-direction: the mono is the interface voice)
withDefaults(defineProps<{ tone?: 'neutral' | 'accent' }>(), { tone: 'neutral' })

const TONES = {
  neutral: 'border-border text-text-muted',
  accent: 'border-accent text-accent',
} as const
</script>

<template>
  <span
    class="inline-flex min-h-(--target-min) items-center rounded-chip border px-2 font-mono text-step--1 uppercase tracking-label"
    :class="TONES[tone]"
  >
    <slot />
  </span>
</template>
