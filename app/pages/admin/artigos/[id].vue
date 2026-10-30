<script setup lang="ts">
// One article's pt-BR working copy (F06-T1): title and slug (following the title until edited), excerpt, body,
// cover, topics, SEO with a search-result preview, noindex and featured. Save sends only what changed, with the
// version read; a 409 on "version" means another tab saved first and nothing here is written. Every rule is the
// server's; the screen shows the same ones before sending. Autosave and revisions are F06-T2
import { can } from '#shared/auth/permissions'
import { ARTICLE_LIMITS } from '#shared/content/article-input'
import { canonicalJson } from '#shared/content/canonical-json'
import type { DocumentJson } from '#shared/content/document-schema'
import { SOURCE_LOCALE } from '#shared/types/enums'
import { MAX_SLUG_LENGTH, SLUG_PATTERN, slugify } from '#shared/utils/slugify'
import ConfirmDialog from '~/components/admin/ConfirmDialog.vue'
import TopicPicker from '~/components/admin/articles/TopicPicker.vue'
import MediaField from '~/components/admin/media/MediaField.vue'
import SerpPreview from '~/components/admin/seo/SerpPreview.vue'
import type { ArticleDetail, TopicItem } from '~/utils/admin/articles'
import { apiError, hasIssue } from '~/utils/admin/articles'
import { formatDateTime } from '~/utils/admin/format'
import { adminFetch, useAdminUser } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

const ContentEditor = defineAsyncComponent(() => import('~/components/admin/editor/ContentEditor.vue'))

interface Draft {
  title: string
  slug: string
  excerpt: string
  body: DocumentJson | undefined
  seoTitle: string
  seoDescription: string
  ogImageMediaId: string | null
  noindex: boolean
  coverMediaId: string | null
  tagIds: string[]
  featured: boolean
}
type Field = 'title' | 'slug' | 'excerpt' | 'seoTitle' | 'seoDescription' | 'coverMediaId' | 'ogImageMediaId' | 'body' | 'tagIds'

const { t } = useI18n()
const route = useRoute()
const user = useAdminUser()
const id = computed(() => String(route.params.id))
const article = ref<ArticleDetail | null>(null)
const topics = ref<TopicItem[]>([])
const missing = ref(false)
const draft = ref<Draft>()
const saved = ref<Draft>()
const slugFollows = ref(false)
// The editor's model changes on open too (missing block ids); only a real edit makes the body unsaved
const bodyEdited = ref(false)
const errors = ref<Partial<Record<Field, string>>>({})
const status = ref<{ tone: 'success' | 'warning' | 'danger', text: string, stale?: boolean }>()
const saving = ref(false)
const confirmDelete = useTemplateRef<InstanceType<typeof ConfirmDialog>>('confirmDelete')

const copy = computed(() => article.value?.localizations.find(item => item.locale === SOURCE_LOCALE))
const canDelete = computed(() => can(user.value?.role ?? '', { article: ['delete'] }))

function draftOf(detail: ArticleDetail): Draft {
  const localization = detail.localizations.find(item => item.locale === SOURCE_LOCALE)!
  return {
    title: localization.title,
    slug: localization.slug,
    excerpt: localization.excerpt,
    body: localization.body,
    seoTitle: localization.seoTitle ?? '',
    seoDescription: localization.seoDescription ?? '',
    ogImageMediaId: localization.ogImageMediaId,
    noindex: localization.noindex,
    coverMediaId: detail.coverMediaId,
    tagIds: [...detail.tagIds],
    featured: detail.featured,
  }
}

// JSON data only; a JSON round trip also reads through the reactive proxies nested in the body
const clone = (value: Draft): Draft => JSON.parse(JSON.stringify(value)) as Draft

async function load() {
  try {
    const [detail, list] = await Promise.all([
      adminFetch<ArticleDetail>(`/api/admin/articles/${encodeURIComponent(id.value)}`),
      adminFetch<{ items: TopicItem[] }>('/api/admin/tags'),
    ])
    article.value = detail
    topics.value = list.items
    draft.value = draftOf(detail)
    saved.value = clone(draft.value)
    slugFollows.value = draft.value.slug === slugify(draft.value.title)
    bodyEdited.value = false
    errors.value = {}
  }
  catch {
    missing.value = true
  }
}
onMounted(load)

watch(() => draft.value?.title, (title) => {
  if (draft.value && slugFollows.value && title !== undefined) {
    draft.value.slug = slugify(title) || draft.value.slug
  }
})
watch(() => draft.value?.body, (body) => {
  if (!bodyEdited.value && saved.value) {
    saved.value.body = body
  }
})

function editSlug(value: string) {
  slugFollows.value = false
  draft.value!.slug = value
}

function slugFromTitle() {
  slugFollows.value = true
  draft.value!.slug = slugify(draft.value!.title) || draft.value!.slug
}

/** The fields that differ from the last save, as the API takes them */
const changes = computed(() => {
  if (!draft.value || !saved.value) {
    return {}
  }
  const now = draft.value
  const before = saved.value
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(now) as (keyof Draft)[]) {
    if (canonicalJson(now[key] ?? null) !== canonicalJson(before[key] ?? null)) {
      out[key] = key === 'seoTitle' || key === 'seoDescription' ? (now[key] as string).trim() || null : now[key]
    }
  }
  return out
})
const dirty = computed(() => Object.keys(changes.value).length > 0)

function validate(): boolean {
  const value = draft.value!
  const next: Partial<Record<Field, string>> = {}
  if (value.title.trim() === '') {
    next.title = t('admin.articles.edit.titleRequired')
  }
  if (!SLUG_PATTERN.test(value.slug) || value.slug.length > MAX_SLUG_LENGTH) {
    next.slug = t('admin.articles.edit.slugInvalid')
  }
  errors.value = next
  return Object.keys(next).length === 0
}

// The server names the field; the message shown is ours, in the admin's language
function messageFor(field: Field): string {
  switch (field) {
    case 'coverMediaId':
    case 'ogImageMediaId':
      return t('admin.articles.edit.mediaNotReady')
    case 'body':
      return t('admin.articles.edit.bodyInvalid')
    case 'tagIds':
      return t('admin.articles.edit.topicMissing')
    case 'title':
      return t('admin.articles.edit.titleRequired')
    case 'slug':
      return t('admin.articles.edit.slugInvalid')
    default:
      return t('admin.articles.edit.fieldInvalid')
  }
}

async function save() {
  if (!draft.value || !copy.value || saving.value) {
    return
  }
  status.value = undefined
  if (!validate()) {
    status.value = { tone: 'danger', text: t('admin.articles.edit.invalid') }
    return
  }
  if (!dirty.value) {
    status.value = { tone: 'success', text: t('admin.articles.edit.saved') }
    return
  }
  saving.value = true
  try {
    const detail = await adminFetch<ArticleDetail>(`/api/admin/articles/${encodeURIComponent(id.value)}`, {
      method: 'PATCH',
      body: { version: copy.value.version, ...changes.value },
    })
    article.value = detail
    // The server trims text and turns blank SEO fields into null; the body stays as the editor has it
    const fresh = draftOf(detail)
    draft.value = { ...fresh, body: draft.value.body }
    saved.value = clone(draft.value)
    bodyEdited.value = false
    status.value = { tone: 'success', text: t('admin.articles.edit.saved') }
  }
  catch (error) {
    const { status: code, issues } = apiError(error)
    if (code === 409 && hasIssue(issues, 'version')) {
      status.value = { tone: 'danger', text: t('admin.articles.edit.stale'), stale: true }
    }
    else if (code === 409 && hasIssue(issues, 'slug')) {
      errors.value = { slug: t('admin.articles.edit.slugTaken') }
      status.value = { tone: 'danger', text: t('admin.articles.edit.invalid') }
    }
    else if (code === 400 && issues.length > 0) {
      errors.value = Object.fromEntries(issues.map(issue => [issue.path.split('.')[0], messageFor(issue.path.split('.')[0] as Field)]))
      status.value = { tone: 'danger', text: t('admin.articles.edit.invalid') }
    }
    else if (code === 403) {
      status.value = { tone: 'danger', text: t('admin.articles.edit.forbidden') }
    }
    else {
      status.value = { tone: 'danger', text: t('admin.articles.edit.failed') }
    }
  }
  finally {
    saving.value = false
  }
}

async function remove() {
  try {
    await adminFetch(`/api/admin/articles/${encodeURIComponent(id.value)}`, { method: 'DELETE' })
    saved.value = draft.value && clone(draft.value)
    await navigateTo('/admin/artigos')
  }
  catch (error) {
    const { status: code } = apiError(error)
    status.value = {
      tone: 'danger',
      text: code === 409 ? t('admin.articles.edit.deletePublished') : code === 403 ? t('admin.articles.edit.deleteForbidden') : t('admin.common.unexpectedError'),
    }
  }
}

// Leaving with unsaved changes asks first, in the admin and when closing the tab
const warnBeforeUnload = (event: BeforeUnloadEvent) => {
  if (dirty.value) {
    event.preventDefault()
  }
}
onMounted(() => window.addEventListener('beforeunload', warnBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload))
onBeforeRouteLeave(() => !dirty.value || window.confirm(t('admin.articles.edit.unsaved')))

useHead({ title: () => draft.value?.title || t('admin.articles.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid grid-cols-1 gap-10">
    <p>
      <NuxtLink
        to="/admin/artigos"
        class="inline-flex min-h-(--target-min) items-center underline underline-offset-(--underline-offset) hover:text-accent"
      >
        {{ $t('admin.articles.edit.back') }}
      </NuxtLink>
    </p>

    <p v-if="missing">
      {{ $t('admin.articles.edit.notFound') }}
    </p>

    <form
      v-else-if="draft && copy && article"
      class="grid grid-cols-1 gap-10"
      novalidate
      @submit.prevent="save"
    >
      <div class="grid gap-3">
        <UiHeading
          :level="1"
          :size="4"
          class="break-words"
        >
          {{ draft.title || $t('admin.articles.untitled') }}
        </UiHeading>
        <p class="text-text-muted">
          {{ $t('admin.articles.edit.meta', {
            status: $t(`admin.articles.statuses.${copy.status}`),
            version: copy.version,
            words: copy.wordCount,
            date: formatDateTime(copy.updatedAt),
          }) }}
        </p>
      </div>

      <section
        class="grid max-w-3xl gap-6"
        aria-labelledby="article-content"
      >
        <UiHeading
          id="article-content"
          :level="2"
          :size="3"
        >
          {{ $t('admin.articles.edit.content') }}
        </UiHeading>
        <UiField
          v-slot="field"
          :label="$t('admin.articles.edit.titleField')"
          :error="errors.title"
          required
        >
          <UiInput
            v-model="draft.title"
            v-bind="field"
            :maxlength="ARTICLE_LIMITS.title"
          />
        </UiField>
        <div class="grid gap-2">
          <UiField
            v-slot="field"
            :label="$t('admin.articles.edit.slug')"
            :description="$t('admin.articles.edit.slugHint', { slug: draft.slug || '…' })"
            :error="errors.slug"
            required
          >
            <UiInput
              :model-value="draft.slug"
              v-bind="field"
              :maxlength="MAX_SLUG_LENGTH"
              autocomplete="off"
              spellcheck="false"
              @update:model-value="editSlug"
            />
          </UiField>
          <p
            v-if="slugFollows"
            class="text-step--1 text-text-muted"
          >
            {{ $t('admin.articles.edit.slugFollows') }}
          </p>
          <UiButton
            v-else
            variant="ghost"
            size="sm"
            class="justify-self-start"
            @click="slugFromTitle"
          >
            {{ $t('admin.articles.edit.slugFromTitle') }}
          </UiButton>
        </div>
        <UiField
          v-slot="field"
          :label="$t('admin.articles.edit.excerpt')"
          :description="$t('admin.articles.edit.excerptHint', { max: ARTICLE_LIMITS.excerpt })"
          :error="errors.excerpt"
        >
          <UiTextarea
            v-model="draft.excerpt"
            v-bind="field"
            :maxlength="ARTICLE_LIMITS.excerpt"
            :rows="3"
          />
        </UiField>
      </section>

      <section
        class="grid gap-4"
        aria-labelledby="article-body"
      >
        <UiHeading
          id="article-body"
          :level="2"
          :size="3"
        >
          {{ $t('admin.articles.edit.body') }}
        </UiHeading>
        <UiFieldError
          id="article-body-error"
          :message="errors.body"
        />
        <ContentEditor
          v-model="draft.body"
          :label="$t('admin.articles.edit.body')"
          @edit="bodyEdited = true"
        />
      </section>

      <section
        class="grid max-w-3xl gap-6"
        aria-labelledby="article-presentation"
      >
        <UiHeading
          id="article-presentation"
          :level="2"
          :size="3"
        >
          {{ $t('admin.articles.edit.cover') }} · {{ $t('admin.articles.edit.topics') }}
        </UiHeading>
        <MediaField
          v-model="draft.coverMediaId"
          :label="$t('admin.articles.edit.cover')"
          :empty="$t('admin.articles.edit.coverNone')"
          :choose="$t('admin.articles.edit.chooseCover')"
          :change="$t('admin.articles.edit.changeCover')"
          :remove="$t('admin.articles.edit.removeCover')"
          :error="errors.coverMediaId"
        />
        <TopicPicker
          v-model="draft.tagIds"
          :topics="topics"
          @created="topics = [...topics, $event].sort((a, b) => a.name.localeCompare(b.name))"
        />
        <UiFieldError
          id="article-topics-error"
          :message="errors.tagIds"
        />
        <label class="inline-flex min-h-(--target-min) items-center gap-2">
          <input
            v-model="draft.featured"
            type="checkbox"
            class="size-5 accent-accent"
          >
          {{ $t('admin.articles.edit.featured') }}
        </label>
      </section>

      <section
        class="grid max-w-3xl gap-6"
        aria-labelledby="article-seo"
      >
        <UiHeading
          id="article-seo"
          :level="2"
          :size="3"
        >
          {{ $t('admin.articles.edit.seo') }}
        </UiHeading>
        <UiField
          v-slot="field"
          :label="$t('admin.articles.edit.seoTitle')"
          :description="$t('admin.articles.edit.seoTitleHint')"
          :error="errors.seoTitle"
        >
          <UiInput
            v-model="draft.seoTitle"
            v-bind="field"
            :maxlength="ARTICLE_LIMITS.seoTitle"
          />
        </UiField>
        <UiField
          v-slot="field"
          :label="$t('admin.articles.edit.seoDescription')"
          :description="$t('admin.articles.edit.seoDescriptionHint')"
          :error="errors.seoDescription"
        >
          <UiTextarea
            v-model="draft.seoDescription"
            v-bind="field"
            :maxlength="ARTICLE_LIMITS.seoDescription"
            :rows="3"
          />
        </UiField>
        <MediaField
          v-model="draft.ogImageMediaId"
          :label="$t('admin.articles.edit.ogImage')"
          :empty="$t('admin.articles.edit.ogImageNone')"
          :choose="$t('admin.articles.edit.chooseOgImage')"
          :change="$t('admin.articles.edit.chooseOgImage')"
          :remove="$t('admin.articles.edit.removeOgImage')"
          :error="errors.ogImageMediaId"
        />
        <label class="inline-flex min-h-(--target-min) items-center gap-2">
          <input
            v-model="draft.noindex"
            type="checkbox"
            class="size-5 accent-accent"
          >
          {{ $t('admin.articles.edit.noindex') }}
        </label>
        <SerpPreview
          :title="draft.seoTitle.trim() || draft.title"
          :description="draft.seoDescription.trim() || draft.excerpt"
          :path="`/blog/${draft.slug}`"
          :noindex="draft.noindex"
        />
      </section>

      <div class="sticky bottom-0 z-(--z-header) grid gap-3 border-t border-border bg-bg py-4">
        <div class="flex flex-wrap items-center gap-3">
          <UiButton
            type="submit"
            :disabled="saving"
          >
            {{ saving ? $t('admin.articles.edit.saving') : $t('admin.articles.edit.save') }}
          </UiButton>
          <p
            v-if="dirty && !status"
            class="text-step--1 text-text-muted"
          >
            {{ $t('admin.articles.edit.unsaved') }}
          </p>
          <UiButton
            v-if="canDelete"
            variant="ghost"
            class="ms-auto"
            @click="confirmDelete?.open()"
          >
            {{ $t('admin.articles.edit.delete') }}
          </UiButton>
        </div>
        <UiStatusMessage
          v-if="status"
          :tone="status.tone"
        >
          {{ status.text }}
          <UiButton
            v-if="status.stale"
            variant="secondary"
            size="sm"
            class="ms-2"
            @click="load"
          >
            {{ $t('admin.articles.edit.reload') }}
          </UiButton>
        </UiStatusMessage>
      </div>
    </form>

    <ConfirmDialog
      ref="confirmDelete"
      :title="$t('admin.articles.edit.deleteTitle')"
      :text="$t('admin.articles.edit.deleteText')"
      :confirm-label="$t('admin.articles.edit.deleteConfirm')"
      @confirm="remove"
    />
  </div>
</template>
