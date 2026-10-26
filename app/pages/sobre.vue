<script setup lang="ts">
definePageMeta({
  i18n: {
    paths: {
      'pt-BR': '/sobre',
      'en': '/about',
      'es': '/sobre-mi',
      'de': '/ueber-mich',
      'fr': '/a-propos',
    },
  },
})

usePlaceholderPage('pages.about.title')
</script>

<template>
  <main>
    <h1>{{ $t('pages.about.title') }}</h1>
    <p>[PLACEHOLDER]</p>
  </main>
</template>
