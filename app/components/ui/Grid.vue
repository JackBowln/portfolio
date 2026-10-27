<script setup lang="ts">
// Editorial grid (design-direction §5): 4 columns on mobile, 8 from 768 px, 12 from 1024 px, fluid gutter.
// Children pick their span with col-span-* utilities
withDefaults(defineProps<{ as?: string }>(), { as: 'div' })
</script>

<template>
  <component
    :is="as"
    class="grid grid-cols-4 gap-gutter md:grid-cols-8 lg:grid-cols-12"
  >
    <slot />
  </component>
</template>
