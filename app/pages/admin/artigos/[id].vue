<script setup lang="ts">
// One article's pt-BR working copy (F06-T1): title and slug (following the title until edited), excerpt, body,
// cover, topics, SEO with a search-result preview, noindex and featured. Changes save themselves 2 s after the
// last edit (F06-T2), sending only what changed with the version read: a 409 on "version" means another tab saved
// first, so autosave stops and the conflict dialog asks which version stays; nothing is overwritten silently.
// "Save version" names a point in the history, and the history compares and restores. Every rule is the server's;
// the screen shows the same ones before sending
import { can } from '#shared/auth/permissions'
import { ARTICLE_LIMITS } from '#shared/content/article-input'
import { canonicalJson } from '#shared/content/canonical-json'
import type { DocumentJson } from '#shared/content/document-schema'
import { SOURCE_LOCALE } from '#shared/types/enums'
import { MAX_SLUG_LENGTH, SLUG_PATTERN, slugify } from '#shared/utils/slugify'
import ConfirmDialog from '~/components/admin/ConfirmDialog.vue'
import PreviewLink from '~/components/admin/articles/PreviewLink.vue'
import PublishPanel from '~/components/admin/articles/PublishPanel.vue'
import TopicPicker from '~/components/admin/articles/TopicPicker.vue'
import ConflictDialog from '~/components/admin/history/ConflictDialog.vue'
import HistoryPanel from '~/components/admin/history/HistoryPanel.vue'
import SaveVersionDialog from '~/components/admin/history/SaveVersionDialog.vue'
import MediaField from '~/components/admin/media/MediaField.vue'
import SerpPreview from '~/components/admin/seo/SerpPreview.vue'
import { useAutosave } from '~/composables/admin/useAutosave'
import type { SaveOutcome } from '~/composables/admin/useAutosave'
import type { ArticleDetail, TopicItem } from '~/utils/admin/articles'
import { apiError, hasIssue } from '~/utils/admin/articles'
import type { VersionFields } from '~/utils/admin/document-diff'
import { diffVersions } from '~/utils/admin/document-diff'
import { formatDateTime } from '~/utils/admin/format'
import type { RevisionItem } from '~/utils/admin/revisions'
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
// The editor reads its content once: a new key remounts it with a restored or reloaded body
const editorKey = ref(0)
const errors = ref<Partial<Record<Field, string>>>({})
const status = ref<{ tone: 'success' | 'warning' | 'danger', text: string }>()
const conflict = ref<{ theirs: ArticleDetail, theirFields: VersionFields, mine: VersionFields } | null>(null)
const historyRefresh = ref(0)
const confirmDelete = useTemplateRef<InstanceType<typeof ConfirmDialog>>('confirmDelete')
const conflictDialog = useTemplateRef<InstanceType<typeof ConflictDialog>>('conflictDialog')
const versionDialog = useTemplateRef<InstanceType<typeof SaveVersionDialog>>('versionDialog')

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
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** The draft as the history and the conflict dialog compare versions */
function fieldsOf(value: Draft): VersionFields {
  return {
    title: value.title,
    slug: value.slug,
    excerpt: value.excerpt,
    seoTitle: value.seoTitle.trim() || null,
    seoDescription: value.seoDescription.trim() || null,
    ogImageMediaId: value.ogImageMediaId,
    noindex: value.noindex,
    coverMediaId: value.coverMediaId,
    tagIds: value.tagIds,
    body: value.body ?? { type: 'doc', content: [] },
  }
}

/** Shows a version from the server as the working state: the draft, the last save and a fresh editor */
function apply(detail: ArticleDetail) {
  article.value = detail
  draft.value = draftOf(detail)
  saved.value = clone(draft.value)
  slugFollows.value = draft.value.slug === slugify(draft.value.title)
  bodyEdited.value = false
  errors.value = {}
  editorKey.value++
}

async function load() {
  try {
    const [detail, list] = await Promise.all([
      adminFetch<ArticleDetail>(`/api/admin/articles/${encodeURIComponent(id.value)}`),
      adminFetch<{ items: TopicItem[] }>('/api/admin/tags'),
    ])
    topics.value = list.items
    apply(detail)
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

/** One save of what changed; the autosave decides when */
async function persist(): Promise<SaveOutcome> {
  if (!draft.value || !copy.value) {
    return 'saved'
  }
  if (!validate()) {
    return 'invalid'
  }
  if (!dirty.value) {
    return 'saved'
  }
  const sent = clone(draft.value)
  try {
    const detail = await adminFetch<ArticleDetail>(`/api/admin/articles/${encodeURIComponent(id.value)}`, {
      method: 'PATCH',
      body: { version: copy.value.version, ...changes.value },
    })
    article.value = detail
    // Fields untouched while saving take the server's form (trimmed, blank SEO as empty); edits made meanwhile
    // stay, and so does the body, which the editor owns
    const fresh: Draft = { ...draftOf(detail), body: sent.body }
    const now = draft.value
    for (const key of Object.keys(fresh) as (keyof Draft)[]) {
      if (key !== 'body' && canonicalJson(now[key] ?? null) === canonicalJson(sent[key] ?? null) && canonicalJson(now[key] ?? null) !== canonicalJson(fresh[key] ?? null)) {
        (now as unknown as Record<string, unknown>)[key] = fresh[key]
      }
    }
    saved.value = clone(fresh)
    errors.value = {}
    if (status.value?.tone === 'danger') {
      status.value = undefined
    }
    return 'saved'
  }
  catch (error) {
    const { status: code, issues } = apiError(error)
    if (code === 409 && hasIssue(issues, 'version')) {
      await openConflict()
      return 'conflict'
    }
    if (code === 409 && hasIssue(issues, 'slug')) {
      errors.value = { slug: t('admin.articles.edit.slugTaken') }
      return 'invalid'
    }
    if (code === 400 && issues.length > 0) {
      errors.value = Object.fromEntries(issues.map(issue => [issue.path.split('.')[0], messageFor(issue.path.split('.')[0] as Field)]))
      return 'invalid'
    }
    if (code === 403) {
      status.value = { tone: 'danger', text: t('admin.articles.edit.forbidden') }
      return 'invalid'
    }
    return 'error'
  }
}

const autosave = useAutosave({ dirty, save: persist })

watch(draft, () => {
  // An edit ends a pause (the next save checks the fields again); a conflict waits for the dialog
  if (autosave.state.value === 'paused' && !conflict.value) {
    errors.value = {}
    autosave.resume()
  }
  autosave.changed()
}, { deep: true })

const autosaveText = computed(() => {
  const state = autosave.state.value
  if (state === 'saved' && autosave.savedAt.value) {
    return t('admin.articles.edit.autosave.saved', { time: autosave.savedAt.value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) })
  }
  if (state === 'paused' && Object.keys(errors.value).length > 0) {
    return t('admin.articles.edit.invalid')
  }
  return t(`admin.articles.edit.autosave.${state}`)
})

async function saveNow() {
  if (conflict.value) {
    conflictDialog.value?.open()
    return
  }
  autosave.resume()
  await autosave.flush()
}

/** Saved changes that are not on the site: the server's working copy against the published snapshot */
const unpublishedChanges = computed(() => {
  const published = copy.value?.publishedSnapshot
  if (!published || !copy.value || !article.value) {
    return false
  }
  const working = copy.value
  return !diffVersions(
    { ...published.localization, coverMediaId: published.entity.coverMediaId, tagIds: published.entity.tagIds },
    { ...working, coverMediaId: article.value.coverMediaId, tagIds: article.value.tagIds },
  ).identical
})

/** After a publish action: the server's view of the article; the draft (the same text) stays as typed */
function published(detail: ArticleDetail) {
  article.value = detail
}

/** The link shows the saved text: what is pending is saved first, and nothing is generated while it cannot be */
async function saveBeforePreview(): Promise<boolean> {
  await saveNow()
  return !conflict.value && !dirty.value
}

async function openConflict() {
  autosave.pause()
  const theirs = await adminFetch<ArticleDetail>(`/api/admin/articles/${encodeURIComponent(id.value)}`)
  conflict.value = { theirs, theirFields: fieldsOf(draftOf(theirs)), mine: fieldsOf(clone(draft.value!)) }
  conflictDialog.value?.open()
}

/** Saves this tab's version on top of the other: the changes are now measured against the saved version */
function keepMine() {
  const theirs = conflict.value!.theirs
  article.value = theirs
  saved.value = draftOf(theirs)
  bodyEdited.value = true
  conflict.value = null
  autosave.resume()
}

function useTheirs() {
  apply(conflict.value!.theirs)
  conflict.value = null
  autosave.resume()
}

async function saveVersion(note: string) {
  await saveNow()
  if (conflict.value || dirty.value || !copy.value) {
    return
  }
  try {
    const response = await adminFetch.raw<RevisionItem>(`/api/admin/articles/${encodeURIComponent(id.value)}/revisions`, {
      method: 'POST',
      body: { version: copy.value.version, note },
    })
    const revision = response._data!
    status.value = { tone: 'success', text: response.status === 201 ? t('admin.history.version.saved', { number: revision.number }) : t('admin.history.version.repeated') }
    historyRefresh.value++
  }
  catch (error) {
    const { status: code, issues } = apiError(error)
    if (code === 409 && hasIssue(issues, 'version')) {
      await openConflict()
    }
    else {
      status.value = { tone: 'danger', text: code === 403 ? t('admin.articles.edit.forbidden') : t('admin.common.unexpectedError') }
    }
  }
}

async function restore(revision: RevisionItem) {
  await saveNow()
  if (conflict.value || !copy.value) {
    return
  }
  try {
    const detail = await adminFetch<ArticleDetail>(`/api/admin/articles/${encodeURIComponent(id.value)}/restore`, {
      method: 'POST',
      body: { version: copy.value.version, revisionId: revision.id },
    })
    apply(detail)
    status.value = { tone: 'success', text: t('admin.history.restored', { number: revision.number }) }
    historyRefresh.value++
  }
  catch (error) {
    const { status: code, issues } = apiError(error)
    if (code === 409 && hasIssue(issues, 'version')) {
      await openConflict()
    }
    else if (code === 409 && hasIssue(issues, 'slug')) {
      status.value = { tone: 'danger', text: t('admin.history.restoreSlugTaken') }
    }
    else {
      status.value = { tone: 'danger', text: code === 403 ? t('admin.articles.edit.forbidden') : t('admin.common.unexpectedError') }
    }
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

// Leaving saves what is pending first; it asks only if something could not be saved
const warnBeforeUnload = (event: BeforeUnloadEvent) => {
  if (dirty.value) {
    event.preventDefault()
  }
}
onMounted(() => window.addEventListener('beforeunload', warnBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload))
onBeforeRouteLeave(async () => {
  if (!conflict.value) {
    await autosave.flush()
  }
  return !dirty.value || window.confirm(t('admin.articles.edit.unsaved'))
})

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
      @submit.prevent="saveNow"
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
          :key="editorKey"
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

      <section
        class="grid max-w-3xl gap-4"
        aria-labelledby="article-publish"
      >
        <UiHeading
          id="article-publish"
          :level="2"
          :size="3"
        >
          {{ $t('admin.publish.title') }}
        </UiHeading>
        <PublishPanel
          :api-base="`/api/admin/articles/${encodeURIComponent(article.id)}`"
          :copy="copy"
          :changed="unpublishedChanges"
          :before-action="saveBeforePreview"
          @updated="published($event as unknown as ArticleDetail)"
          @conflict="openConflict"
        />
      </section>

      <section
        class="grid max-w-3xl gap-4"
        aria-labelledby="article-preview"
      >
        <UiHeading
          id="article-preview"
          :level="2"
          :size="3"
        >
          {{ $t('admin.preview.title') }}
        </UiHeading>
        <PreviewLink
          :article-id="article.id"
          :before-create="saveBeforePreview"
        />
      </section>

      <section
        class="grid gap-4"
        aria-labelledby="article-history"
      >
        <UiHeading
          id="article-history"
          :level="2"
          :size="3"
        >
          {{ $t('admin.history.title') }}
        </UiHeading>
        <p class="text-text-muted">
          {{ $t('admin.history.intro') }}
        </p>
        <details class="grid gap-4">
          <summary class="inline-flex min-h-(--target-min) cursor-pointer items-center font-strong underline underline-offset-(--underline-offset)">
            {{ $t('admin.history.open') }}
          </summary>
          <HistoryPanel
            class="mt-4"
            :api-base="`/api/admin/articles/${encodeURIComponent(article.id)}`"
            :current="fieldsOf(draft)"
            :topics="topics"
            :refresh="historyRefresh"
            @restore="restore"
          />
        </details>
      </section>

      <div class="sticky bottom-0 z-(--z-header) grid gap-3 border-t border-border bg-bg py-4">
        <div class="flex flex-wrap items-center gap-3">
          <p
            class="text-step--1"
            :class="autosave.state.value === 'retrying' || autosave.state.value === 'paused' ? 'text-danger' : 'text-text-muted'"
            role="status"
            data-testid="autosave-status"
          >
            {{ autosaveText }}
          </p>
          <UiButton
            type="submit"
            variant="secondary"
            size="sm"
          >
            {{ $t('admin.articles.edit.saveNow') }}
          </UiButton>
          <UiButton
            size="sm"
            @click="versionDialog?.open()"
          >
            {{ $t('admin.history.version.button') }}
          </UiButton>
          <UiButton
            v-if="canDelete"
            variant="ghost"
            size="sm"
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
    <SaveVersionDialog
      ref="versionDialog"
      @save="saveVersion"
    />
    <ConflictDialog
      ref="conflictDialog"
      :theirs="conflict?.theirFields ?? null"
      :mine="conflict?.mine ?? null"
      :topics="topics"
      @keep-mine="keepMine"
      @use-theirs="useTheirs"
    />
  </div>
</template>
