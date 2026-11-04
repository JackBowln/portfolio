<script setup lang="ts">
// Native <button>: Enter and Space activate it, `disabled` takes it out of the tab order.
// The label comes through the default slot; an optional icon slot sits after it, hidden from assistive tech
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'md' | 'sm'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}>(), { variant: 'primary', size: 'md', type: 'button', disabled: false })

const VARIANTS = {
  primary: 'border-transparent bg-accent text-accent-contrast enabled:hover:bg-accent-hover enabled:active:bg-accent-active',
  secondary: 'border-text bg-transparent text-text enabled:hover:bg-surface enabled:active:bg-surface-active',
  ghost: 'border-transparent bg-transparent text-text underline-offset-(--underline-offset) enabled:hover:underline enabled:active:bg-surface-active',
} as const

const SIZES = {
  md: 'min-h-(--target-comfortable) px-6 text-step-0',
  sm: 'min-h-(--target-min) px-3 text-step--1',
} as const
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="press inline-flex cursor-pointer items-center justify-center gap-2 rounded-control border font-strong leading-none transition-colors duration-(--dur-instant) ease-out disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled)"
    :class="[VARIANTS[variant], SIZES[size]]"
  >
    <slot />
    <span
      v-if="$slots.icon"
      aria-hidden="true"
      class="inline-flex"
    ><slot name="icon" /></span>
  </button>
</template>
