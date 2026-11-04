<script setup lang="ts">
// "Reduce motion" (storyboard-home §10, decision 4): a toggle button like the theme one, invisible until mounted
// (it does nothing without JS). It only reduces: when the system already asks for it, it is pressed and disabled,
// and says why
import { useReducedMotion } from '~/composables/motion/useReducedMotion'

const { ready, system, reduced, toggle } = useReducedMotion()
const hintId = useId()
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-2"
    :class="{ invisible: !ready }"
  >
    <button
      type="button"
      class="inline-flex min-h-(--target-comfortable) items-center gap-2 border border-border px-3 font-mono text-step--1 uppercase tracking-label disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled)"
      :aria-pressed="reduced"
      :disabled="system"
      :aria-describedby="system ? hintId : undefined"
      data-testid="reduce-motion"
      @click="toggle"
    >
      {{ $t('layout.reduceMotion.label') }}
    </button>
    <span
      v-if="system"
      :id="hintId"
      class="text-step--1 text-text-muted"
    >{{ $t('layout.reduceMotion.system') }}</span>
  </div>
</template>
