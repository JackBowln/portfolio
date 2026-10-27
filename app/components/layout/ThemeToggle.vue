<script setup lang="ts">
// Toggle button (WAI-ARIA APG): "Dark theme", pressed or not. It stays invisible until mounted, because only the
// browser knows the theme and the button does nothing without JS; visibility keeps its space, so nothing shifts
const { theme, toggleTheme } = useTheme()
</script>

<template>
  <button
    type="button"
    class="inline-flex min-h-(--target-comfortable) items-center gap-2 border border-border px-3 font-mono text-step--1 uppercase tracking-label"
    :class="{ invisible: !theme }"
    :aria-pressed="theme === 'dark'"
    @click="toggleTheme"
  >
    {{ $t('layout.themeToggle.label') }}
  </button>
</template>
