<script setup lang="ts">
// Same path in every locale (i18n-seo §2), so no `paths` override
usePlaceholderPage('pages.blog.title')
</script>

<template>
  <main>
    <h1>{{ $t('pages.blog.title') }}</h1>
    <p>[PLACEHOLDER]</p>
  </main>
</template>
