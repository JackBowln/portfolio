<script setup lang="ts">
// Translations (F09-T4): everything on the site in pt-BR, with the state of each target locale; each opens its review,
// where it can be translated with AI, edited, approved and published. The server checks translation:review
import { TARGET_LOCALES } from '#shared/translation/glossary'
import type { Locale, TranslationState } from '#shared/types/enums'
import StatusBadge from '~/components/admin/translation/StatusBadge.vue'
import { adminFetch } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

interface Item {
  type: 'article' | 'project' | 'page'
  id: string
  title: string
  pageKey: string | null
  locales: Partial<Record<Locale, TranslationState>>
}

const { t } = useI18n()
const items = ref<Item[]>([])
const loaded = ref(false)
const failed = ref(false)

onMounted(async () => {
  try {
    items.value = (await adminFetch<{ items: Item[] }>('/api/admin/translations/items')).items
    loaded.value = true
  }
  catch {
    failed.value = true
  }
})

const titleOf = (item: Item) => (item.pageKey ? t(`admin.pages.names.${item.pageKey}`) : item.title)

useHead({ title: () => t('admin.translations.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid gap-6">
    <div class="grid gap-3">
      <UiHeading :level="1">
        {{ $t('admin.translations.title') }}
      </UiHeading>
      <p>{{ $t('admin.translations.intro') }}</p>
      <NuxtLink
        to="/admin/traducoes/textos"
        class="justify-self-start underline underline-offset-(--underline-offset) hover:text-accent"
      >
        {{ $t('admin.translations.texts.link') }}
      </NuxtLink>
    </div>
    <UiStatusMessage
      v-if="failed"
      tone="danger"
    >
      {{ $t('admin.common.unexpectedError') }}
    </UiStatusMessage>
    <template v-if="loaded">
      <p v-if="items.length === 0">
        {{ $t('admin.translations.empty') }}
      </p>
      <div
        v-else
        class="overflow-x-auto"
      >
        <table class="w-full text-start text-step--1">
          <caption class="sr-only">
            {{ $t('admin.translations.title') }}
          </caption>
          <thead>
            <tr class="border-b border-border">
              <th
                scope="col"
                class="py-2 pe-4 text-start"
              >
                {{ $t('admin.translations.item') }}
              </th>
              <th
                v-for="locale in TARGET_LOCALES"
                :key="locale"
                scope="col"
                class="py-2 pe-4 text-start"
              >
                {{ locale }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in items"
              :key="`${item.type}-${item.id}`"
              class="border-b border-border"
              data-testid="translation-item"
            >
              <th
                scope="row"
                class="py-2 pe-4 text-start font-strong"
              >
                {{ titleOf(item) }}
                <span class="block font-regular text-text-muted">{{ $t(`admin.translations.types.${item.type}`) }}</span>
              </th>
              <td
                v-for="locale in TARGET_LOCALES"
                :key="locale"
                class="py-2 pe-4"
              >
                <NuxtLink
                  :to="`/admin/traducoes/${item.type}/${item.id}/${locale}`"
                  class="inline-flex min-h-(--target-min) items-center"
                >
                  <StatusBadge
                    :locale="locale"
                    :state="item.locales[locale] ?? 'missing'"
                  />
                  <!-- The visible badge starts the link's name; the rest says what it opens -->
                  <UiVisuallyHidden>{{ $t('admin.translations.open', { title: titleOf(item) }) }}</UiVisuallyHidden>
                </NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
