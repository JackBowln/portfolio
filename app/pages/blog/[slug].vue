<script setup lang="ts">
// Same path in every locale (i18n-seo §2), so no `paths` override; long-form text uses the reading layout
definePageMeta({ layout: 'reading' })

usePlaceholderPage('pages.article.title')

// Intl example required by F02-T2; the real publication date arrives with the content (F05)
const formatDate = useFormatDate()
const sampleDate = computed(() => formatDate('2026-01-15'))
</script>

<template>
  <div>
    <h1>{{ $t('pages.article.title') }}</h1>
    <p>[PLACEHOLDER]</p>
    <p>{{ $t('common.sampleDate', { date: sampleDate }) }}</p>
  </div>
</template>
