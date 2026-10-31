<script setup lang="ts">
// Articles (F06-T1): newest change first, filtered by status, locale and translation state (in the query string,
// so a filtered view can be shared or reloaded), more on demand, and "new article" from a title alone, which opens
// the editor (decision 4)
import { can } from '#shared/auth/permissions'
import { ARTICLE_LIMITS } from '#shared/content/article-input'
import { LOCALES, PUBLICATION_STATUSES, SOURCE_LOCALE, TRANSLATION_STATES } from '#shared/types/enums'
import type { Locale, PublicationStatus, TranslationState } from '#shared/types/enums'
import StatusBadge from '~/components/admin/translation/StatusBadge.vue'
import type { ArticleDetail, ArticleListItem } from '~/utils/admin/articles'
import { formatDateTime } from '~/utils/admin/format'
import { adminFetch, useAdminUser } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const route = useRoute()
const user = useAdminUser()
const canCreate = computed(() => can(user.value?.role ?? '', { article: ['create'] }))

interface Filters { status: '' | PublicationStatus, locale: '' | Locale, translationState: '' | TranslationState }
const pick = <T extends string>(value: unknown, allowed: readonly T[]): '' | T => (allowed.includes(value as T) ? value as T : '')
const fromQuery = (): Filters => ({
  status: pick(route.query.status, PUBLICATION_STATUSES),
  locale: pick(route.query.locale, LOCALES),
  translationState: pick(route.query.translationState, TRANSLATION_STATES),
})
const filters = ref<Filters>(fromQuery())
const items = ref<ArticleListItem[]>([])
const cursor = ref<string | null>(null)
const loaded = ref(false)
const loading = ref(false)
const failed = ref(false)
const title = ref('')
const createError = ref<string>()

const queryOf = (applied: Filters) => Object.fromEntries(Object.entries(applied).filter(([, value]) => value !== ''))

async function load(append = false) {
  loading.value = true
  failed.value = false
  try {
    const page = await adminFetch<{ items: ArticleListItem[], nextCursor: string | null }>('/api/admin/articles', {
      query: { ...queryOf(fromQuery()), limit: 20, ...(append && cursor.value ? { cursor: cursor.value } : {}) },
    })
    items.value = append ? [...items.value, ...page.items] : page.items
    cursor.value = page.nextCursor
    loaded.value = true
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
}

watch(() => route.query, () => {
  filters.value = fromQuery()
  load()
})
onMounted(load)

async function create() {
  createError.value = undefined
  if (title.value.trim() === '') {
    createError.value = t('admin.articles.edit.titleRequired')
    return
  }
  try {
    const article = await adminFetch<ArticleDetail>('/api/admin/articles', { method: 'POST', body: { title: title.value } })
    await navigateTo(`/admin/artigos/${article.id}`)
  }
  catch {
    createError.value = t('admin.articles.create.failed')
  }
}

const source = (item: ArticleListItem) => item.localizations.find(localization => localization.locale === SOURCE_LOCALE) ?? item.localizations[0]

useHead({ title: () => t('admin.articles.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid grid-cols-1 gap-10">
    <div class="grid gap-3">
      <UiHeading
        :level="1"
        :size="4"
      >
        {{ $t('admin.articles.title') }}
      </UiHeading>
      <p class="text-text-muted">
        {{ $t('admin.articles.intro') }}
      </p>
    </div>

    <section
      v-if="canCreate"
      class="grid max-w-xl gap-4"
      aria-labelledby="article-create"
    >
      <UiHeading
        id="article-create"
        :level="2"
        :size="3"
      >
        {{ $t('admin.articles.create.title') }}
      </UiHeading>
      <form
        class="flex flex-wrap items-end gap-3"
        novalidate
        @submit.prevent="create"
      >
        <UiField
          v-slot="field"
          class="min-w-[min(100%,20rem)] flex-1"
          :label="$t('admin.articles.create.label')"
          :error="createError"
          required
        >
          <UiInput
            v-model="title"
            v-bind="field"
            :maxlength="ARTICLE_LIMITS.title"
          />
        </UiField>
        <UiButton type="submit">
          {{ $t('admin.articles.create.submit') }}
        </UiButton>
      </form>
    </section>

    <form
      class="flex flex-wrap items-end gap-4"
      :aria-label="$t('admin.articles.filters.legend')"
      @submit.prevent="navigateTo({ query: queryOf(filters) })"
    >
      <UiField
        v-slot="field"
        :label="$t('admin.articles.filters.status')"
      >
        <select
          :id="field.id"
          v-model="filters.status"
          class="min-h-(--target-comfortable) border border-border bg-bg px-3"
        >
          <option value="">
            {{ $t('admin.articles.filters.anyStatus') }}
          </option>
          <option
            v-for="item in PUBLICATION_STATUSES"
            :key="item"
            :value="item"
          >
            {{ $t(`admin.articles.statuses.${item}`) }}
          </option>
        </select>
      </UiField>
      <UiField
        v-slot="field"
        :label="$t('admin.articles.filters.locale')"
      >
        <select
          :id="field.id"
          v-model="filters.locale"
          class="min-h-(--target-comfortable) border border-border bg-bg px-3"
        >
          <option value="">
            {{ $t('admin.articles.filters.anyLocale') }}
          </option>
          <option
            v-for="item in LOCALES"
            :key="item"
            :value="item"
          >
            {{ $t(`admin.articles.locales.${item}`) }}
          </option>
        </select>
      </UiField>
      <UiField
        v-slot="field"
        :label="$t('admin.articles.filters.translation')"
      >
        <select
          :id="field.id"
          v-model="filters.translationState"
          class="min-h-(--target-comfortable) border border-border bg-bg px-3"
        >
          <option value="">
            {{ $t('admin.articles.filters.anyTranslation') }}
          </option>
          <option
            v-for="item in TRANSLATION_STATES"
            :key="item"
            :value="item"
          >
            {{ $t(`admin.articles.translationStates.${item}`) }}
          </option>
        </select>
      </UiField>
      <UiButton
        type="submit"
        variant="secondary"
      >
        {{ $t('admin.articles.filters.apply') }}
      </UiButton>
    </form>

    <UiStatusMessage
      v-if="failed"
      tone="danger"
    >
      {{ $t('admin.common.unexpectedError') }}
    </UiStatusMessage>
    <p v-else-if="loaded && items.length === 0">
      {{ $t('admin.articles.empty') }}
    </p>
    <div
      v-else-if="items.length > 0"
      class="overflow-x-auto"
      role="group"
      tabindex="0"
      :aria-label="$t('admin.articles.table.caption')"
    >
      <table class="w-full border-collapse text-start text-step--1">
        <caption class="sr-only">
          {{ $t('admin.articles.table.caption') }}
        </caption>
        <thead>
          <tr class="border-b border-border">
            <th
              scope="col"
              class="py-2 pe-4 text-start"
            >
              {{ $t('admin.articles.table.title') }}
            </th>
            <th
              scope="col"
              class="py-2 pe-4 text-start"
            >
              {{ $t('admin.articles.table.status') }}
            </th>
            <th
              scope="col"
              class="py-2 pe-4 text-start"
            >
              {{ $t('admin.articles.table.locales') }}
            </th>
            <th
              scope="col"
              class="py-2 pe-4 text-start"
            >
              {{ $t('admin.articles.table.author') }}
            </th>
            <th
              scope="col"
              class="py-2 text-start"
            >
              {{ $t('admin.articles.table.updated') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.id"
            class="border-b border-border align-top"
            data-testid="article-row"
          >
            <th
              scope="row"
              class="py-3 pe-4 text-start font-strong"
            >
              <NuxtLink
                :to="`/admin/artigos/${item.id}`"
                class="inline-flex min-h-(--target-min) items-center underline underline-offset-(--underline-offset) hover:text-accent"
              >
                {{ source(item)?.title || $t('admin.articles.untitled') }}
              </NuxtLink>
            </th>
            <td class="py-3 pe-4">
              {{ source(item) ? $t(`admin.articles.statuses.${source(item)!.status}`) : '—' }}
            </td>
            <td class="py-3 pe-4">
              <span class="flex flex-wrap gap-1">
                <StatusBadge
                  v-for="localization in item.localizations"
                  :key="localization.locale"
                  :locale="localization.locale"
                  :state="localization.translationState"
                />
              </span>
            </td>
            <td class="py-3 pe-4">
              {{ item.authorName ?? '—' }}
            </td>
            <td class="py-3">
              {{ formatDateTime(item.updatedAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="cursor">
      <UiButton
        variant="secondary"
        :disabled="loading"
        @click="load(true)"
      >
        {{ $t('admin.articles.more') }}
      </UiButton>
    </div>
  </div>
</template>
