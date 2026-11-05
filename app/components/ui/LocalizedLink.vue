<script setup lang="ts">
// Internal links always go through the active locale: `to` is the pt-BR path, translated by @nuxtjs/i18n. The
// contact page brings its own CSP (Turnstile, F08-T3), which only a page load from the server applies, so links to
// it leave the router (F12-T1: reached through the menu, the form could not load Turnstile)
const FULL_LOAD = '/contato'
defineProps<{ to: string }>()
</script>

<template>
  <NuxtLinkLocale
    :to="to"
    :external="to === FULL_LOAD"
  >
    <slot />
  </NuxtLinkLocale>
</template>
