<script setup lang="ts">
// Text for assistive technology only (WCAG 1.3.1); `as` keeps the right element
withDefaults(defineProps<{ as?: string }>(), { as: 'span' })
</script>

<template>
  <component
    :is="as"
    class="sr-only"
  >
    <slot />
  </component>
</template>
