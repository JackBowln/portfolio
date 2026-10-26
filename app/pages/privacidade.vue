<script setup lang="ts">
definePageMeta({
  i18n: {
    paths: {
      'pt-BR': '/privacidade',
      'en': '/privacy',
      'es': '/privacidad',
      'de': '/datenschutz',
      'fr': '/confidentialite',
    },
  },
})

usePlaceholderPage('pages.privacy.title')
</script>

<template>
  <main>
    <h1>{{ $t('pages.privacy.title') }}</h1>
    <p>[PLACEHOLDER]</p>
  </main>
</template>
