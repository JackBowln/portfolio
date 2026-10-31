<script setup lang="ts">
// The notice of an institutional page shown in pt-BR because it has no translation in this locale (i18n-seo §3)
</script>

<template>
  <p
    role="note"
    class="border-s-4 border-accent bg-surface px-4 py-3 text-step--1"
    data-testid="fallback-notice"
  >
    {{ $t('pages.fallbackNotice') }}
  </p>
</template>
