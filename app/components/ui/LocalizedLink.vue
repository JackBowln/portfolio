<script setup lang="ts">
// Internal links always go through the active locale: `to` is the pt-BR path, translated by @nuxtjs/i18n
defineProps<{ to: string }>()
</script>

<template>
  <NuxtLinkLocale :to="to">
    <slot />
  </NuxtLinkLocale>
</template>
