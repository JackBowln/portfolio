<script setup lang="ts">
definePageMeta({
  i18n: {
    paths: {
      'pt-BR': '/projetos',
      'en': '/projects',
      'es': '/proyectos',
      'de': '/projekte',
      'fr': '/projets',
    },
  },
})

usePlaceholderPage('pages.projects.title')
</script>

<template>
  <div>
    <h1>{{ $t('pages.projects.title') }}</h1>
    <p>[PLACEHOLDER]</p>
  </div>
</template>
