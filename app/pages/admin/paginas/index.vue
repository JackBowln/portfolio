<script setup lang="ts">
// Institutional pages (F08-T2): the six fixed pages with their state; each opens its block editor
import { PAGE_KEYS, SOURCE_LOCALE } from '#shared/types/enums'
import { formatDateTime } from '~/utils/admin/format'
import type { PageListItem } from '~/utils/admin/pages'
import { adminFetch } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const items = ref<PageListItem[]>([])
const failed = ref(false)

onMounted(async () => {
  try {
    items.value = (await adminFetch<{ items: PageListItem[] }>('/api/admin/pages')).items
  }
  catch {
    failed.value = true
  }
})

const source = (item: PageListItem) => item.localizations.find(localization => localization.locale === SOURCE_LOCALE)

useHead({ title: () => t('admin.pages.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid grid-cols-1 gap-10">
    <div class="grid gap-3">
      <UiHeading
        :level="1"
        :size="4"
      >
        {{ $t('admin.pages.title') }}
      </UiHeading>
      <p class="text-text-muted">
        {{ $t('admin.pages.intro') }}
      </p>
    </div>
    <UiStatusMessage
      v-if="failed"
      tone="danger"
    >
      {{ $t('admin.common.unexpectedError') }}
    </UiStatusMessage>
    <ul
      v-else
      class="grid gap-2"
    >
      <li
        v-for="key in PAGE_KEYS"
        :key="key"
        class="grid gap-1 border-b border-border py-3"
        data-testid="page-row"
      >
        <NuxtLink
          :to="`/admin/paginas/${key}`"
          class="justify-self-start font-strong underline underline-offset-(--underline-offset) hover:text-accent"
        >
          {{ $t(`admin.pages.names.${key}`) }}
        </NuxtLink>
        <p
          v-if="items.find(item => item.key === key)"
          class="text-step--1 text-text-muted"
        >
          {{ $t(`admin.articles.statuses.${source(items.find(item => item.key === key)!)?.status ?? 'draft'}`) }}
          · {{ $t('admin.pages.updated', { date: formatDateTime(source(items.find(item => item.key === key)!)!.updatedAt) }) }}
        </p>
      </li>
    </ul>
  </div>
</template>
