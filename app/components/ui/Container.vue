<script setup lang="ts">
// Horizontal frame with the fluid gutter: `reading` keeps lines at 68ch, `default` caps at 1440 px, `full` only pads
withDefaults(defineProps<{
  size?: 'reading' | 'default' | 'full'
  as?: string
}>(), { size: 'default', as: 'div' })

const SIZES = {
  reading: 'max-w-(--container-reading)',
  default: 'max-w-(--container-max)',
  full: '',
} as const
</script>

<template>
  <component
    :is="as"
    class="mx-auto w-full px-gutter"
    :class="SIZES[size]"
  >
    <slot />
  </component>
</template>
