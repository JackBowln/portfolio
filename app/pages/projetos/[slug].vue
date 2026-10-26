<script setup lang="ts">
definePageMeta({
  i18n: {
    paths: {
      'pt-BR': '/projetos/[slug]',
      'en': '/projects/[slug]',
      'es': '/proyectos/[slug]',
      'de': '/projekte/[slug]',
      'fr': '/projets/[slug]',
    },
  },
})

usePlaceholderPage('pages.project.title')
</script>

<template>
  <main>
    <h1>{{ $t('pages.project.title') }}</h1>
    <p>[PLACEHOLDER]</p>
  </main>
</template>
