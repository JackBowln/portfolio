<script setup lang="ts">
// One project's pt-BR working copy (F07-T1, RF-09.1): title and slug (following the title until edited), summary,
// role, period, GitHub and demo links (https: only), verifiable results, the case-study body (it starts with the
// Contexto, Desafio, Solução and Resultados sections), cover, gallery, technologies, featured and SEO. It works like
// the article editor: changes save themselves 2 s after the last edit with the version read, a 409 on "version"
// opens the conflict dialog, "save version" names a point in the history, and the history compares and restores.
// Every rule is the server's; the screen shows the same ones before sending. Projects are published by hand
import { can } from '#shared/auth/permissions'
import { canonicalJson } from '#shared/content/canonical-json'
import type { DocumentJson } from '#shared/content/document-schema'
import { PROJECT_LIMITS, YEAR_MONTH } from '#shared/content/project-input'
import type { ProjectHighlightInput } from '#shared/content/project-input'
import { SOURCE_LOCALE } from '#shared/types/enums'
import { MAX_SLUG_LENGTH, SLUG_PATTERN, slugify } from '#shared/utils/slugify'
import ConfirmDialog from '~/components/admin/ConfirmDialog.vue'
import PublishPanel from '~/components/admin/articles/PublishPanel.vue'
import TopicPicker from '~/components/admin/articles/TopicPicker.vue'
import ConflictDialog from '~/components/admin/history/ConflictDialog.vue'
import HistoryPanel from '~/components/admin/history/HistoryPanel.vue'
import SaveVersionDialog from '~/components/admin/history/SaveVersionDialog.vue'
import MediaField from '~/components/admin/media/MediaField.vue'
import GalleryField from '~/components/admin/projects/GalleryField.vue'
import HighlightsEditor from '~/components/admin/projects/HighlightsEditor.vue'
import OgImagePanel from '~/components/admin/seo/OgImagePanel.vue'
import SerpPreview from '~/components/admin/seo/SerpPreview.vue'
import { useAutosave } from '~/composables/admin/useAutosave'
import type { SaveOutcome } from '~/composables/admin/useAutosave'
import type { TopicItem } from '~/utils/admin/articles'
import { apiError, hasIssue } from '~/utils/admin/articles'
import type { AnyVersionFields } from '~/utils/admin/document-diff'
import { diffVersions, PROJECT_DIFF_FIELDS } from '~/utils/admin/document-diff'
import { formatDateTime } from '~/utils/admin/format'
import type { ProjectDetail } from '~/utils/admin/projects'
import type { RevisionItem } from '~/utils/admin/revisions'
import { adminFetch, useAdminUser } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

const ContentEditor = defineAsyncComponent(() => import('~/components/admin/editor/ContentEditor.vue'))

interface Draft {
  title: string
  slug: string
  summary: string
  role: string
  highlights: ProjectHighlightInput[]
  body: DocumentJson | undefined
  seoTitle: string
  seoDescription: string
  ogImageMediaId: string | null
  noindex: boolean
  coverMediaId: string | null
  galleryMediaIds: string[]
  technologyIds: string[]
  periodStart: string
  periodEnd: string
  repoUrl: string
  demoUrl: string
  featured: boolean
}
type Field = 'title' | 'slug' | 'summary' | 'role' | 'highlights' | 'seoTitle' | 'seoDescription' | 'coverMediaId' | 'ogImageMediaId' | 'body'
  | 'galleryMediaIds' | 'technologyIds' | 'periodStart' | 'periodEnd' | 'repoUrl' | 'demoUrl'

// Empty text fields that the API takes as null
const NULLABLE = new Set<keyof Draft>(['seoTitle', 'seoDescription', 'periodStart', 'periodEnd', 'repoUrl', 'demoUrl'])

const { t } = useI18n()
const route = useRoute()
const user = useAdminUser()
const id = computed(() => String(route.params.id))
const apiBase = computed(() => `/api/admin/projects/${encodeURIComponent(id.value)}`)
const project = ref<ProjectDetail | null>(null)
const technologies = ref<TopicItem[]>([])
const missing = ref(false)
const draft = ref<Draft>()
const saved = ref<Draft>()
const slugFollows = ref(false)
// The editor's model changes on open too (missing block ids); only a real edit makes the body unsaved
const bodyEdited = ref(false)
// The editor reads its content once: a new key remounts it with a restored or reloaded body
const editorKey = ref(0)
const errors = ref<Partial<Record<Field, string>>>({})
const highlightErrors = ref<Record<number, string>>({})
const status = ref<{ tone: 'success' | 'warning' | 'danger', text: string }>()
const conflict = ref<{ theirs: ProjectDetail, theirFields: AnyVersionFields, mine: AnyVersionFields } | null>(null)
const historyRefresh = ref(0)
const confirmDelete = useTemplateRef<InstanceType<typeof ConfirmDialog>>('confirmDelete')
const conflictDialog = useTemplateRef<InstanceType<typeof ConflictDialog>>('conflictDialog')
const versionDialog = useTemplateRef<InstanceType<typeof SaveVersionDialog>>('versionDialog')

const copy = computed(() => project.value?.localizations.find(item => item.locale === SOURCE_LOCALE))
const canDelete = computed(() => can(user.value?.role ?? '', { project: ['delete'] }))

function draftOf(detail: ProjectDetail): Draft {
  const localization = detail.localizations.find(item => item.locale === SOURCE_LOCALE)!
  return {
    title: localization.title,
    slug: localization.slug,
    summary: localization.summary,
    role: localization.role,
    highlights: localization.highlights.map(item => ({ ...item })),
    body: localization.body,
    seoTitle: localization.seoTitle ?? '',
    seoDescription: localization.seoDescription ?? '',
    ogImageMediaId: localization.ogImageMediaId,
    noindex: localization.noindex,
    coverMediaId: detail.coverMediaId,
    galleryMediaIds: [...detail.galleryMediaIds],
    technologyIds: [...detail.technologyIds],
    periodStart: detail.periodStart ?? '',
    periodEnd: detail.periodEnd ?? '',
    repoUrl: detail.repoUrl ?? '',
    demoUrl: detail.demoUrl ?? '',
    featured: detail.featured,
  }
}

// JSON data only; a JSON round trip also reads through the reactive proxies nested in the body
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

const valueOf = (key: keyof Draft, value: Draft[keyof Draft]) => (NULLABLE.has(key) ? (value as string).trim() || null : value)
// A note left empty is no note
const highlightsOf = (items: ProjectHighlightInput[]) => items.map(({ label, value, note }) => ({ label: label.trim(), value: value.trim(), ...(note?.trim() ? { note: note.trim() } : {}) }))

/** The draft as the history and the conflict dialog compare versions */
function fieldsOf(value: Draft): AnyVersionFields {
  const fields: AnyVersionFields = { body: value.body ?? { type: 'doc', content: [] } }
  for (const key of Object.keys(value) as (keyof Draft)[]) {
    if (key !== 'body' && key !== 'featured') {
      fields[key] = key === 'highlights' ? highlightsOf(value.highlights) : valueOf(key, value[key])
    }
  }
  return fields
}

/** Shows a version from the server as the working state: the draft, the last save and a fresh editor */
function apply(detail: ProjectDetail) {
  project.value = detail
  draft.value = draftOf(detail)
  saved.value = clone(draft.value)
  slugFollows.value = draft.value.slug === slugify(draft.value.title)
  bodyEdited.value = false
  errors.value = {}
  highlightErrors.value = {}
  editorKey.value++
}

async function load() {
  try {
    const [detail, list] = await Promise.all([
      adminFetch<ProjectDetail>(apiBase.value),
      adminFetch<{ items: TopicItem[] }>('/api/admin/tags', { query: { kind: 'technology' } }),
    ])
    technologies.value = list.items
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
      out[key] = key === 'highlights' ? highlightsOf(now.highlights) : valueOf(key, now[key])
    }
  }
  return out
})
const dirty = computed(() => Object.keys(changes.value).length > 0)

const isHttps = (value: string) => {
  try {
    return new URL(value).protocol === 'https:'
  }
  catch {
    return false
  }
}

function validate(): boolean {
  const value = draft.value!
  const next: Partial<Record<Field, string>> = {}
  if (value.title.trim() === '') {
    next.title = t('admin.articles.edit.titleRequired')
  }
  if (!SLUG_PATTERN.test(value.slug) || value.slug.length > MAX_SLUG_LENGTH) {
    next.slug = t('admin.articles.edit.slugInvalid')
  }
  for (const key of ['repoUrl', 'demoUrl'] as const) {
    if (value[key].trim() !== '' && !isHttps(value[key].trim())) {
      next[key] = t('admin.projects.edit.httpsOnly')
    }
  }
  for (const key of ['periodStart', 'periodEnd'] as const) {
    if (value[key] !== '' && !YEAR_MONTH.test(value[key])) {
      next[key] = t('admin.projects.edit.periodInvalid')
    }
  }
  if (!next.periodEnd && value.periodStart && value.periodEnd && value.periodEnd < value.periodStart) {
    next.periodEnd = t('admin.projects.edit.periodOrder')
  }
  const rows: Record<number, string> = {}
  value.highlights.forEach((item, index) => {
    if (item.label.trim() === '' || item.value.trim() === '') {
      rows[index] = t('admin.projects.highlights.required')
    }
  })
  highlightErrors.value = rows
  errors.value = next
  return Object.keys(next).length === 0 && Object.keys(rows).length === 0
}

// The server names the field; the message shown is ours, in the admin's language
function messageFor(field: Field): string {
  switch (field) {
    case 'coverMediaId':
    case 'ogImageMediaId':
    case 'galleryMediaIds':
      return t('admin.articles.edit.mediaNotReady')
    case 'body':
      return t('admin.articles.edit.bodyInvalid')
    case 'technologyIds':
      return t('admin.projects.edit.technologyMissing')
    case 'title':
      return t('admin.articles.edit.titleRequired')
    case 'slug':
      return t('admin.articles.edit.slugInvalid')
    case 'repoUrl':
    case 'demoUrl':
      return t('admin.projects.edit.httpsOnly')
    case 'periodStart':
      return t('admin.projects.edit.periodInvalid')
    case 'periodEnd':
      return t('admin.projects.edit.periodOrder')
    case 'highlights':
      return t('admin.projects.highlights.required')
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
    const detail = await adminFetch<ProjectDetail>(apiBase.value, {
      method: 'PATCH',
      body: { version: copy.value.version, ...changes.value },
    })
    project.value = detail
    // Fields untouched while saving take the server's form (trimmed, blank as empty); edits made meanwhile stay, and
    // so does the body, which the editor owns
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
      status.value = { tone: 'danger', text: t('admin.projects.edit.forbidden') }
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
    highlightErrors.value = {}
    autosave.resume()
  }
  autosave.changed()
}, { deep: true })

const autosaveText = computed(() => {
  const state = autosave.state.value
  if (state === 'saved' && autosave.savedAt.value) {
    return t('admin.articles.edit.autosave.saved', { time: autosave.savedAt.value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) })
  }
  if (state === 'paused' && (Object.keys(errors.value).length > 0 || Object.keys(highlightErrors.value).length > 0)) {
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
  if (!published || !copy.value || !project.value) {
    return false
  }
  const { featured: _featured, localizations: _localizations, ...entity } = project.value
  return !diffVersions({ ...published.entity, ...published.localization }, { ...entity, ...copy.value }, PROJECT_DIFF_FIELDS).identical
})

/** After a publish action: the server's view of the project; the draft (the same text) stays as typed */
function published(detail: ProjectDetail) {
  project.value = detail
  // F11-T2: publishing (or the button) may set a generated share image; the draft and the last save follow it
  const ogImageMediaId = detail.localizations.find(item => item.locale === SOURCE_LOCALE)?.ogImageMediaId ?? null
  if (draft.value && saved.value && saved.value.ogImageMediaId !== ogImageMediaId) {
    draft.value.ogImageMediaId = ogImageMediaId
    saved.value.ogImageMediaId = ogImageMediaId
  }
}

/** Publishing acts on the saved text: what is pending is saved first */
async function saveBeforePublish(): Promise<boolean> {
  await saveNow()
  return !conflict.value && !dirty.value
}

async function openConflict() {
  autosave.pause()
  const theirs = await adminFetch<ProjectDetail>(apiBase.value)
  conflict.value = { theirs, theirFields: fieldsOf(draftOf(theirs)), mine: fieldsOf(clone(draft.value!)) }
  conflictDialog.value?.open()
}

/** Saves this tab's version on top of the other: the changes are now measured against the saved version */
function keepMine() {
  const theirs = conflict.value!.theirs
  project.value = theirs
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
    const response = await adminFetch.raw<RevisionItem>(`${apiBase.value}/revisions`, {
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
      status.value = { tone: 'danger', text: code === 403 ? t('admin.projects.edit.forbidden') : t('admin.common.unexpectedError') }
    }
  }
}

async function restore(revision: RevisionItem) {
  await saveNow()
  if (conflict.value || !copy.value) {
    return
  }
  try {
    const detail = await adminFetch<ProjectDetail>(`${apiBase.value}/restore`, {
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
      status.value = { tone: 'danger', text: code === 403 ? t('admin.projects.edit.forbidden') : t('admin.common.unexpectedError') }
    }
  }
}

async function remove() {
  try {
    await adminFetch(apiBase.value, { method: 'DELETE' })
    saved.value = draft.value && clone(draft.value)
    await navigateTo('/admin/projetos')
  }
  catch (error) {
    const { status: code } = apiError(error)
    status.value = {
      tone: 'danger',
      text: code === 409 ? t('admin.projects.edit.deletePublished') : code === 403 ? t('admin.projects.edit.deleteForbidden') : t('admin.common.unexpectedError'),
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

useHead({ title: () => draft.value?.title || t('admin.projects.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid grid-cols-1 gap-10">
    <p>
      <NuxtLink
        to="/admin/projetos"
        class="inline-flex min-h-(--target-min) items-center underline underline-offset-(--underline-offset) hover:text-accent"
      >
        {{ $t('admin.projects.edit.back') }}
      </NuxtLink>
    </p>

    <p v-if="missing">
      {{ $t('admin.projects.edit.notFound') }}
    </p>

    <form
      v-else-if="draft && copy && project"
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
        aria-labelledby="project-content"
      >
        <UiHeading
          id="project-content"
          :level="2"
          :size="3"
        >
          {{ $t('admin.projects.edit.content') }}
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
            :maxlength="PROJECT_LIMITS.title"
          />
        </UiField>
        <div class="grid gap-2">
          <UiField
            v-slot="field"
            :label="$t('admin.articles.edit.slug')"
            :description="$t('admin.projects.edit.slugHint', { slug: draft.slug || '…' })"
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
          :label="$t('admin.projects.edit.summary')"
          :description="$t('admin.projects.edit.summaryHint', { max: PROJECT_LIMITS.summary })"
          :error="errors.summary"
        >
          <UiTextarea
            v-model="draft.summary"
            v-bind="field"
            :maxlength="PROJECT_LIMITS.summary"
            :rows="3"
          />
        </UiField>
        <UiField
          v-slot="field"
          :label="$t('admin.projects.edit.role')"
          :description="$t('admin.projects.edit.roleHint')"
          :error="errors.role"
        >
          <UiInput
            v-model="draft.role"
            v-bind="field"
            :maxlength="PROJECT_LIMITS.role"
          />
        </UiField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UiField
            v-slot="field"
            :label="$t('admin.projects.edit.periodStart')"
            :description="$t('admin.projects.edit.periodHint')"
            :error="errors.periodStart"
          >
            <UiInput
              v-model="draft.periodStart"
              v-bind="field"
              type="month"
            />
          </UiField>
          <UiField
            v-slot="field"
            :label="$t('admin.projects.edit.periodEnd')"
            :description="$t('admin.projects.edit.periodEndHint')"
            :error="errors.periodEnd"
          >
            <UiInput
              v-model="draft.periodEnd"
              v-bind="field"
              type="month"
            />
          </UiField>
        </div>
        <UiField
          v-slot="field"
          :label="$t('admin.projects.edit.repoUrl')"
          :description="$t('admin.projects.edit.urlHint')"
          :error="errors.repoUrl"
        >
          <UiInput
            v-model="draft.repoUrl"
            v-bind="field"
            type="url"
            inputmode="url"
            autocomplete="off"
            spellcheck="false"
            :maxlength="PROJECT_LIMITS.url"
          />
        </UiField>
        <UiField
          v-slot="field"
          :label="$t('admin.projects.edit.demoUrl')"
          :description="$t('admin.projects.edit.urlHint')"
          :error="errors.demoUrl"
        >
          <UiInput
            v-model="draft.demoUrl"
            v-bind="field"
            type="url"
            inputmode="url"
            autocomplete="off"
            spellcheck="false"
            :maxlength="PROJECT_LIMITS.url"
          />
        </UiField>
      </section>

      <section
        class="grid max-w-3xl gap-4"
        aria-labelledby="project-results"
      >
        <UiHeading
          id="project-results"
          :level="2"
          :size="3"
        >
          {{ $t('admin.projects.highlights.title') }}
        </UiHeading>
        <HighlightsEditor
          v-model="draft.highlights"
          :errors="highlightErrors"
        />
        <UiFieldError
          id="project-highlights-error"
          :message="errors.highlights"
        />
      </section>

      <section
        class="grid gap-4"
        aria-labelledby="project-body"
      >
        <UiHeading
          id="project-body"
          :level="2"
          :size="3"
        >
          {{ $t('admin.projects.edit.body') }}
        </UiHeading>
        <p class="text-text-muted">
          {{ $t('admin.projects.edit.bodyHint') }}
        </p>
        <UiFieldError
          id="project-body-error"
          :message="errors.body"
        />
        <ContentEditor
          :key="editorKey"
          v-model="draft.body"
          :label="$t('admin.projects.edit.body')"
          @edit="bodyEdited = true"
        />
      </section>

      <section
        class="grid max-w-3xl gap-6"
        aria-labelledby="project-presentation"
      >
        <UiHeading
          id="project-presentation"
          :level="2"
          :size="3"
        >
          {{ $t('admin.projects.edit.presentation') }}
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
        <GalleryField
          v-model="draft.galleryMediaIds"
          :error="errors.galleryMediaIds"
        />
        <TopicPicker
          v-model="draft.technologyIds"
          kind="technology"
          :max="PROJECT_LIMITS.technologies"
          :topics="technologies"
          @created="technologies = [...technologies, $event].sort((a, b) => a.name.localeCompare(b.name))"
        />
        <UiFieldError
          id="project-technologies-error"
          :message="errors.technologyIds"
        />
        <label class="inline-flex min-h-(--target-min) items-center gap-2">
          <input
            v-model="draft.featured"
            type="checkbox"
            class="size-5 accent-accent"
          >
          {{ $t('admin.projects.edit.featured') }}
        </label>
      </section>

      <section
        class="grid max-w-3xl gap-6"
        aria-labelledby="project-seo"
      >
        <UiHeading
          id="project-seo"
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
            :maxlength="PROJECT_LIMITS.seoTitle"
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
            :maxlength="PROJECT_LIMITS.seoDescription"
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
        <OgImagePanel
          :target="{ type: 'project', id: project.id }"
          :before-action="saveBeforePublish"
          @updated="published($event as unknown as ProjectDetail)"
          @conflict="openConflict"
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
          :description="draft.seoDescription.trim() || draft.summary"
          :path="`/projetos/${draft.slug}`"
          :noindex="draft.noindex"
        />
      </section>

      <section
        class="grid max-w-3xl gap-4"
        aria-labelledby="project-publish"
      >
        <UiHeading
          id="project-publish"
          :level="2"
          :size="3"
        >
          {{ $t('admin.publish.title') }}
        </UiHeading>
        <PublishPanel
          :api-base="apiBase"
          resource="project"
          :copy="copy"
          :changed="unpublishedChanges"
          :before-action="saveBeforePublish"
          :share-image="{ type: 'project', id: project.id }"
          @updated="published($event as unknown as ProjectDetail)"
          @conflict="openConflict"
        />
      </section>

      <section
        class="grid gap-4"
        aria-labelledby="project-history"
      >
        <UiHeading
          id="project-history"
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
            :api-base="apiBase"
            resource="project"
            :current="fieldsOf(draft)"
            :topics="technologies"
            :fields="PROJECT_DIFF_FIELDS"
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
            {{ $t('admin.projects.edit.delete') }}
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
      :title="$t('admin.projects.edit.deleteTitle')"
      :text="$t('admin.projects.edit.deleteText')"
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
      :topics="technologies"
      :fields="PROJECT_DIFF_FIELDS"
      @keep-mine="keepMine"
      @use-theirs="useTheirs"
    />
  </div>
</template>
