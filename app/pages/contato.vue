<script setup lang="ts">
definePageMeta({
  i18n: {
    paths: {
      'pt-BR': '/contato',
      'en': '/contact',
      'es': '/contacto',
      'de': '/kontakt',
      'fr': '/contact',
    },
  },
})

usePlaceholderPage('pages.contact.title')
</script>

<template>
  <main>
    <h1>{{ $t('pages.contact.title') }}</h1>
    <p>[PLACEHOLDER]</p>
  </main>
</template>
