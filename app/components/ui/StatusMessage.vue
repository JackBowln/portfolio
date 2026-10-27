<script setup lang="ts">
// Result of an action (form sent, saved, failed). `danger` is an alert (assertive); the others are polite status.
// Keep it mounted and change its content, so screen readers announce the change
const props = withDefaults(defineProps<{ tone?: 'info' | 'success' | 'warning' | 'danger' }>(), { tone: 'info' })

const TONES = {
  info: { icon: 'info', class: 'border-border text-text' },
  success: { icon: 'circle-check', class: 'border-success text-success' },
  warning: { icon: 'triangle-alert', class: 'border-warning text-warning' },
  danger: { icon: 'circle-alert', class: 'border-danger text-danger' },
} as const satisfies Record<string, { icon: IconName, class: string }>

const tone = computed(() => TONES[props.tone])
</script>

<template>
  <div
    :role="props.tone === 'danger' ? 'alert' : 'status'"
    class="flex items-start gap-3 border-l-(length:--focus-ring-width) bg-surface px-4 py-3"
    :class="tone.class"
  >
    <UiIcon
      :name="tone.icon"
      class="mt-1"
    />
    <div class="text-text">
      <slot />
    </div>
  </div>
</template>
