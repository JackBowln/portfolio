<script setup lang="ts">
// First focusable element of the page (WCAG 2.4.1): hidden until focused, then shown above everything
withDefaults(defineProps<{ target?: string }>(), { target: '#main' })
</script>

<template>
  <a
    :href="target"
    class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-(--z-toast) focus:inline-flex focus:min-h-(--target-comfortable) focus:items-center focus:bg-accent focus:px-4 focus:font-strong focus:text-accent-contrast"
  >
    <slot />
  </a>
</template>
