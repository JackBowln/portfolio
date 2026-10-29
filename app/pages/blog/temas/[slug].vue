<script setup lang="ts">
definePageMeta({
  i18n: {
    paths: {
      'pt-BR': '/blog/temas/[slug]',
      'en': '/blog/topics/[slug]',
      'es': '/blog/temas/[slug]',
      'de': '/blog/themen/[slug]',
      'fr': '/blog/sujets/[slug]',
    },
  },
})

usePlaceholderPage('pages.topic.title')
</script>

<template>
  <div>
    <h1>{{ $t('pages.topic.title') }}</h1>
    <p>[PLACEHOLDER]</p>
  </div>
</template>
