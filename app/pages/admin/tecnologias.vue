<script setup lang="ts">
// Technologies of projects (F07-T1)
import TagManager from '~/components/admin/TagManager.vue'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
useHead({ title: () => t('admin.technologies.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <TagManager kind="technology" />
</template>
