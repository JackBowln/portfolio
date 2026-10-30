<script setup lang="ts">
// Topics of articles (F06-T1)
import TagManager from '~/components/admin/TagManager.vue'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
useHead({ title: () => t('admin.tags.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <TagManager kind="topic" />
</template>
