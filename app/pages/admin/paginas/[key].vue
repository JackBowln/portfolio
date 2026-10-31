<script setup lang="ts">
// One institutional page's pt-BR working copy (F08-T2): its blocks (a form per page) and the SEO fields. It works
// like the article editor: changes save themselves 2 s after the last edit with the version read, a 409 on "version"
// opens the conflict dialog, "save version" names a point in the history (compared block by block, decision 3), and
// the page is published by hand. Translations come with F09. Every rule is the server's
import { canonicalJson } from '#shared/content/canonical-json'
import type { DocumentJson } from '#shared/content/document-schema'
import { PAGE_LINK_TARGETS } from '#shared/pages/blocks'
import { PAGE_KEYS, SOURCE_LOCALE } from '#shared/types/enums'
import type { PageKey } from '#shared/types/enums'
import PublishPanel from '~/components/admin/articles/PublishPanel.vue'
import ConflictDialog from '~/components/admin/history/ConflictDialog.vue'
import HistoryPanel from '~/components/admin/history/HistoryPanel.vue'
import SaveVersionDialog from '~/components/admin/history/SaveVersionDialog.vue'
import MediaField from '~/components/admin/media/MediaField.vue'
import { useAutosave } from '~/composables/admin/useAutosave'
import type { SaveOutcome } from '~/composables/admin/useAutosave'
import { apiError, hasIssue } from '~/utils/admin/articles'
import type { AnyVersionFields } from '~/utils/admin/document-diff'
import { diffVersions } from '~/utils/admin/document-diff'
import { formatDateTime } from '~/utils/admin/format'
import type { PageDetail } from '~/utils/admin/pages'
import { pageDiffFields, pageFields } from '~/utils/admin/pages'
import type { RevisionDetail, RevisionItem } from '~/utils/admin/revisions'
import { adminFetch } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

const ContentEditor = defineAsyncComponent(() => import('~/components/admin/editor/ContentEditor.vue'))

interface Draft {
  // The page's own block schema; the forms below know each one
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks: Record<string, any>
  seoTitle: string
  seoDescription: string
  ogImageMediaId: string | null
  noindex: boolean
}

const { t } = useI18n()
const route = useRoute()
const key = computed(() => String(route.params.key) as PageKey)
const known = computed(() => (PAGE_KEYS as readonly string[]).includes(key.value))
const apiBase = computed(() => `/api/admin/pages/${key.value}`)
const page = ref<PageDetail | null>(null)
const missing = ref(false)
const draft = ref<Draft>()
const saved = ref<Draft>()
// The rich-text editor normalizes its document when it opens; only a real edit makes it unsaved
const documentEdited = ref(false)
const editorKey = ref(0)
const status = ref<{ tone: 'success' | 'warning' | 'danger', text: string }>()
const conflict = ref<{ theirs: PageDetail, theirFields: AnyVersionFields, mine: AnyVersionFields } | null>(null)
const historyRefresh = ref(0)
const conflictDialog = useTemplateRef<InstanceType<typeof ConflictDialog>>('conflictDialog')
const versionDialog = useTemplateRef<InstanceType<typeof SaveVersionDialog>>('versionDialog')

const copy = computed(() => page.value?.localizations.find(item => item.locale === SOURCE_LOCALE))
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function draftOf(detail: PageDetail): Draft {
  const localization = detail.localizations.find(item => item.locale === SOURCE_LOCALE)!
  return {
    blocks: clone(localization.blocks),
    seoTitle: localization.seoTitle ?? '',
    seoDescription: localization.seoDescription ?? '',
    ogImageMediaId: localization.ogImageMediaId,
    noindex: localization.noindex,
  }
}

const fieldsOf = (value: Draft) => pageFields({ blocks: value.blocks, seoTitle: value.seoTitle.trim() || null, seoDescription: value.seoDescription.trim() || null, ogImageMediaId: value.ogImageMediaId, noindex: value.noindex })
const diffFields = computed(() => (draft.value ? pageDiffFields(draft.value.blocks) : []))
const revisionFields = (snapshot: RevisionDetail['snapshot']) => pageFields(snapshot.localization as never)

function apply(detail: PageDetail) {
  page.value = detail
  draft.value = draftOf(detail)
  saved.value = clone(draft.value)
  documentEdited.value = false
  editorKey.value++
}

async function load() {
  if (!known.value) {
    missing.value = true
    return
  }
  try {
    apply(await adminFetch<PageDetail>(apiBase.value))
  }
  catch {
    missing.value = true
  }
}
onMounted(load)

/** The rich-text block of this page (about's introduction, privacy's body), as the editor's model */
const documentField = computed(() => (key.value === 'about' ? 'intro' : key.value === 'privacy' ? 'body' : null))
const document = computed({
  get: () => (documentField.value ? (draft.value?.blocks[documentField.value] as DocumentJson | null) ?? undefined : undefined),
  set: (value: DocumentJson | undefined) => {
    if (!draft.value || !documentField.value) {
      return
    }
    draft.value.blocks[documentField.value] = value && value.content.length > 0 ? value : null
    if (!documentEdited.value && saved.value) {
      saved.value.blocks[documentField.value] = draft.value.blocks[documentField.value]
    }
  },
})

const changes = computed(() => {
  if (!draft.value || !saved.value) {
    return {}
  }
  const out: Record<string, unknown> = {}
  for (const field of Object.keys(draft.value) as (keyof Draft)[]) {
    if (canonicalJson(draft.value[field] ?? null) !== canonicalJson(saved.value[field] ?? null)) {
      out[field] = field === 'seoTitle' || field === 'seoDescription' ? (draft.value[field] as string).trim() || null : draft.value[field]
    }
  }
  return out
})
const dirty = computed(() => Object.keys(changes.value).length > 0)

async function persist(): Promise<SaveOutcome> {
  if (!draft.value || !copy.value || !dirty.value) {
    return 'saved'
  }
  const sent = clone(draft.value)
  try {
    const detail = await adminFetch<PageDetail>(apiBase.value, { method: 'PATCH', body: { version: copy.value.version, ...changes.value } })
    page.value = detail
    saved.value = sent
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
    status.value = {
      tone: 'danger',
      text: code === 400 ? t('admin.pages.invalid') : code === 403 ? t('admin.pages.forbidden') : t('admin.common.unexpectedError'),
    }
    return code === 400 || code === 403 ? 'invalid' : 'error'
  }
}

const autosave = useAutosave({ dirty, save: persist })
watch(draft, () => {
  if (autosave.state.value === 'paused' && !conflict.value) {
    autosave.resume()
  }
  autosave.changed()
}, { deep: true })

const autosaveText = computed(() => {
  const state = autosave.state.value
  if (state === 'saved' && autosave.savedAt.value) {
    return t('admin.articles.edit.autosave.saved', { time: autosave.savedAt.value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) })
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

async function saveBeforeAction(): Promise<boolean> {
  await saveNow()
  return !conflict.value && !dirty.value
}

/** Saved changes not on the site: the working copy against the published snapshot, block by block */
const unpublishedChanges = computed(() => {
  const published = copy.value?.publishedSnapshot
  if (!published || !copy.value) {
    return false
  }
  return !diffVersions(pageFields(published.localization), pageFields(copy.value), pageDiffFields(copy.value.blocks)).identical
})

async function openConflict() {
  autosave.pause()
  const theirs = await adminFetch<PageDetail>(apiBase.value)
  conflict.value = { theirs, theirFields: fieldsOf(draftOf(theirs)), mine: fieldsOf(clone(draft.value!)) }
  conflictDialog.value?.open()
}

function keepMine() {
  const theirs = conflict.value!.theirs
  page.value = theirs
  saved.value = draftOf(theirs)
  documentEdited.value = true
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
    const response = await adminFetch.raw<RevisionItem>(`${apiBase.value}/revisions`, { method: 'POST', body: { version: copy.value.version, note } })
    status.value = { tone: 'success', text: response.status === 201 ? t('admin.history.version.saved', { number: response._data!.number }) : t('admin.history.version.repeated') }
    historyRefresh.value++
  }
  catch (error) {
    const { status: code, issues } = apiError(error)
    if (code === 409 && hasIssue(issues, 'version')) {
      await openConflict()
    }
    else {
      status.value = { tone: 'danger', text: code === 403 ? t('admin.pages.forbidden') : t('admin.common.unexpectedError') }
    }
  }
}

async function restore(revision: RevisionItem) {
  await saveNow()
  if (conflict.value || !copy.value) {
    return
  }
  try {
    apply(await adminFetch<PageDetail>(`${apiBase.value}/restore`, { method: 'POST', body: { version: copy.value.version, revisionId: revision.id } }))
    status.value = { tone: 'success', text: t('admin.history.restored', { number: revision.number }) }
    historyRefresh.value++
  }
  catch (error) {
    const { status: code, issues } = apiError(error)
    if (code === 409 && hasIssue(issues, 'version')) {
      await openConflict()
    }
    else {
      status.value = { tone: 'danger', text: code === 403 ? t('admin.pages.forbidden') : t('admin.common.unexpectedError') }
    }
  }
}

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

const select = 'min-h-(--target-comfortable) border border-border bg-bg px-3'
// A list block of the draft (sections, timeline, skills, links), for v-for and its buttons
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const list = (name: string): any[] => draft.value!.blocks[name]

useHead({ title: () => (known.value ? t(`admin.pages.names.${key.value}`) : t('admin.pages.title')), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid grid-cols-1 gap-10">
    <p>
      <NuxtLink
        to="/admin/paginas"
        class="inline-flex min-h-(--target-min) items-center underline underline-offset-(--underline-offset) hover:text-accent"
      >
        {{ $t('admin.pages.back') }}
      </NuxtLink>
    </p>
    <p v-if="missing">
      {{ $t('admin.pages.notFound') }}
    </p>

    <form
      v-else-if="draft && copy && page"
      class="grid grid-cols-1 gap-10"
      novalidate
      @submit.prevent="saveNow"
    >
      <div class="grid gap-3">
        <UiHeading
          :level="1"
          :size="4"
        >
          {{ $t(`admin.pages.names.${key}`) }}
        </UiHeading>
        <p class="text-text-muted">
          {{ $t('admin.pages.meta', { status: $t(`admin.articles.statuses.${copy.status}`), version: copy.version, date: formatDateTime(copy.updatedAt) }) }}
        </p>
      </div>

      <section
        class="grid max-w-3xl gap-6"
        aria-labelledby="page-blocks"
      >
        <UiHeading
          id="page-blocks"
          :level="2"
          :size="3"
        >
          {{ $t('admin.pages.content') }}
        </UiHeading>

        <!-- Home -->
        <template v-if="key === 'home'">
          <fieldset class="grid gap-4">
            <legend class="font-strong">
              {{ $t('admin.pages.home.hero') }}
            </legend>
            <UiField
              v-slot="field"
              :label="$t('admin.pages.home.eyebrow')"
            >
              <UiInput
                v-model="draft.blocks.hero.eyebrow"
                v-bind="field"
                :maxlength="80"
              />
            </UiField>
            <UiField
              v-slot="field"
              :label="$t('admin.pages.home.heroTitle')"
            >
              <UiInput
                v-model="draft.blocks.hero.title"
                v-bind="field"
                :maxlength="160"
              />
            </UiField>
            <UiField
              v-slot="field"
              :label="$t('admin.pages.home.subtitle')"
            >
              <UiTextarea
                v-model="draft.blocks.hero.subtitle"
                v-bind="field"
                :maxlength="300"
                :rows="2"
              />
            </UiField>
            <div class="grid gap-4 sm:grid-cols-2">
              <UiField
                v-slot="field"
                :label="$t('admin.pages.home.ctaLabel')"
              >
                <UiInput
                  v-model="draft.blocks.hero.cta.label"
                  v-bind="field"
                  :maxlength="60"
                />
              </UiField>
              <UiField
                v-slot="field"
                :label="$t('admin.pages.home.ctaTarget')"
              >
                <select
                  :id="field.id"
                  v-model="draft.blocks.hero.cta.target"
                  :class="select"
                >
                  <option
                    v-for="target in PAGE_LINK_TARGETS"
                    :key="target"
                    :value="target"
                  >
                    {{ $t(`layout.nav.${target}`) }}
                  </option>
                </select>
              </UiField>
            </div>
          </fieldset>
          <fieldset class="grid gap-4">
            <legend class="font-strong">
              {{ $t('admin.pages.home.sections') }}
            </legend>
            <div
              v-for="(section, index) in list('sections')"
              :key="index"
              class="grid gap-3 border-b border-border pb-4"
            >
              <UiField
                v-slot="field"
                :label="$t('admin.pages.home.sectionTitle', { number: index + 1 })"
              >
                <UiInput
                  v-model="section.title"
                  v-bind="field"
                  :maxlength="120"
                />
              </UiField>
              <UiField
                v-slot="field"
                :label="$t('admin.pages.home.sectionText', { number: index + 1 })"
                :description="$t('admin.pages.paragraphsHint')"
              >
                <UiTextarea
                  v-model="section.text"
                  v-bind="field"
                  :maxlength="1500"
                  :rows="5"
                />
              </UiField>
              <UiButton
                variant="ghost"
                size="sm"
                class="justify-self-start"
                @click="draft.blocks.sections.splice(index, 1)"
              >
                {{ $t('admin.pages.remove', { item: $t('admin.pages.home.sectionTitle', { number: index + 1 }) }) }}
              </UiButton>
            </div>
            <UiButton
              variant="secondary"
              size="sm"
              class="justify-self-start"
              :disabled="draft.blocks.sections.length >= 6"
              @click="draft.blocks.sections.push({ title: '', text: '' })"
            >
              {{ $t('admin.pages.home.addSection') }}
            </UiButton>
          </fieldset>
          <UiField
            v-slot="field"
            :label="$t('admin.pages.home.featuredTitle')"
            :description="$t('admin.pages.home.featuredHint')"
          >
            <UiInput
              v-model="draft.blocks.featuredTitle"
              v-bind="field"
              :maxlength="120"
            />
          </UiField>
          <UiField
            v-slot="field"
            :label="$t('admin.pages.home.articlesTitle')"
            :description="$t('admin.pages.home.articlesHint')"
          >
            <UiInput
              v-model="draft.blocks.articlesTitle"
              v-bind="field"
              :maxlength="120"
            />
          </UiField>
          <fieldset class="grid gap-4">
            <legend class="font-strong">
              {{ $t('admin.pages.home.closing') }}
            </legend>
            <UiField
              v-slot="field"
              :label="$t('admin.pages.home.closingTitle')"
            >
              <UiInput
                v-model="draft.blocks.closing.title"
                v-bind="field"
                :maxlength="160"
              />
            </UiField>
            <UiField
              v-slot="field"
              :label="$t('admin.pages.home.closingText')"
            >
              <UiTextarea
                v-model="draft.blocks.closing.text"
                v-bind="field"
                :maxlength="500"
                :rows="2"
              />
            </UiField>
            <div class="grid gap-4 sm:grid-cols-2">
              <UiField
                v-slot="field"
                :label="$t('admin.pages.home.closingCtaLabel')"
              >
                <UiInput
                  v-model="draft.blocks.closing.cta.label"
                  v-bind="field"
                  :maxlength="60"
                />
              </UiField>
              <UiField
                v-slot="field"
                :label="$t('admin.pages.home.closingCtaTarget')"
              >
                <select
                  :id="field.id"
                  v-model="draft.blocks.closing.cta.target"
                  :class="select"
                >
                  <option
                    v-for="target in PAGE_LINK_TARGETS"
                    :key="target"
                    :value="target"
                  >
                    {{ $t(`layout.nav.${target}`) }}
                  </option>
                </select>
              </UiField>
            </div>
          </fieldset>
        </template>

        <!-- About -->
        <template v-else-if="key === 'about'">
          <div class="grid gap-2">
            <p class="font-strong">
              {{ $t('admin.pages.about.intro') }}
            </p>
            <ContentEditor
              :key="editorKey"
              v-model="document"
              :label="$t('admin.pages.about.intro')"
              @edit="documentEdited = true"
            />
          </div>
          <fieldset class="grid gap-4">
            <legend class="font-strong">
              {{ $t('pages.about.timeline') }}
            </legend>
            <div
              v-for="(item, index) in list('timeline')"
              :key="index"
              class="grid gap-3 border-b border-border pb-4 sm:grid-cols-[10rem_1fr]"
            >
              <UiField
                v-slot="field"
                :label="$t('admin.pages.about.period', { number: index + 1 })"
              >
                <UiInput
                  v-model="item.period"
                  v-bind="field"
                  :maxlength="40"
                />
              </UiField>
              <UiField
                v-slot="field"
                :label="$t('admin.pages.about.itemTitle', { number: index + 1 })"
              >
                <UiInput
                  v-model="item.title"
                  v-bind="field"
                  :maxlength="120"
                />
              </UiField>
              <UiField
                v-slot="field"
                class="sm:col-span-2"
                :label="$t('admin.pages.about.itemText', { number: index + 1 })"
              >
                <UiTextarea
                  v-model="item.text"
                  v-bind="field"
                  :maxlength="500"
                  :rows="2"
                />
              </UiField>
              <UiButton
                variant="ghost"
                size="sm"
                class="justify-self-start"
                @click="draft.blocks.timeline.splice(index, 1)"
              >
                {{ $t('admin.pages.remove', { item: $t('admin.pages.about.itemTitle', { number: index + 1 }) }) }}
              </UiButton>
            </div>
            <UiButton
              variant="secondary"
              size="sm"
              class="justify-self-start"
              :disabled="draft.blocks.timeline.length >= 20"
              @click="draft.blocks.timeline.push({ period: '', title: '', text: '' })"
            >
              {{ $t('admin.pages.about.addItem') }}
            </UiButton>
          </fieldset>
          <fieldset class="grid gap-4">
            <legend class="font-strong">
              {{ $t('pages.about.skills') }}
            </legend>
            <div
              v-for="(group, index) in list('skills')"
              :key="index"
              class="grid gap-3 border-b border-border pb-4"
            >
              <UiField
                v-slot="field"
                :label="$t('admin.pages.about.group', { number: index + 1 })"
              >
                <UiInput
                  v-model="group.group"
                  v-bind="field"
                  :maxlength="60"
                />
              </UiField>
              <UiField
                v-slot="field"
                :label="$t('admin.pages.about.items', { number: index + 1 })"
                :description="$t('admin.pages.about.itemsHint')"
              >
                <UiTextarea
                  :model-value="group.items.join('\n')"
                  v-bind="field"
                  :rows="3"
                  @update:model-value="group.items = $event.split('\n').slice(0, 20)"
                />
              </UiField>
              <UiButton
                variant="ghost"
                size="sm"
                class="justify-self-start"
                @click="draft.blocks.skills.splice(index, 1)"
              >
                {{ $t('admin.pages.remove', { item: $t('admin.pages.about.group', { number: index + 1 }) }) }}
              </UiButton>
            </div>
            <UiButton
              variant="secondary"
              size="sm"
              class="justify-self-start"
              :disabled="draft.blocks.skills.length >= 10"
              @click="draft.blocks.skills.push({ group: '', items: [] })"
            >
              {{ $t('admin.pages.about.addGroup') }}
            </UiButton>
          </fieldset>
          <fieldset class="grid gap-4">
            <legend class="font-strong">
              {{ $t('pages.about.links') }}
            </legend>
            <div
              v-for="(link, index) in list('links')"
              :key="index"
              class="grid gap-3 border-b border-border pb-4 sm:grid-cols-2"
            >
              <UiField
                v-slot="field"
                :label="$t('admin.pages.about.linkLabel', { number: index + 1 })"
              >
                <UiInput
                  v-model="link.label"
                  v-bind="field"
                  :maxlength="60"
                />
              </UiField>
              <UiField
                v-slot="field"
                :label="$t('admin.pages.about.linkUrl', { number: index + 1 })"
                :description="$t('admin.settings.httpsOnly')"
              >
                <UiInput
                  v-model="link.url"
                  v-bind="field"
                  type="url"
                  :maxlength="500"
                />
              </UiField>
              <UiButton
                variant="ghost"
                size="sm"
                class="justify-self-start"
                @click="draft.blocks.links.splice(index, 1)"
              >
                {{ $t('admin.pages.remove', { item: $t('admin.pages.about.linkLabel', { number: index + 1 }) }) }}
              </UiButton>
            </div>
            <UiButton
              variant="secondary"
              size="sm"
              class="justify-self-start"
              :disabled="draft.blocks.links.length >= 10"
              @click="draft.blocks.links.push({ label: '', url: '' })"
            >
              {{ $t('admin.pages.about.addLink') }}
            </UiButton>
          </fieldset>
        </template>

        <!-- Contact -->
        <template v-else-if="key === 'contact'">
          <UiField
            v-slot="field"
            :label="$t('admin.pages.contact.intro')"
            :description="$t('admin.pages.paragraphsHint')"
          >
            <UiTextarea
              v-model="draft.blocks.intro"
              v-bind="field"
              :maxlength="600"
              :rows="4"
            />
          </UiField>
          <UiField
            v-slot="field"
            :label="$t('admin.pages.contact.success')"
            :description="$t('admin.pages.contact.successHint')"
          >
            <UiInput
              v-model="draft.blocks.success"
              v-bind="field"
              :maxlength="300"
            />
          </UiField>
        </template>

        <!-- Privacy -->
        <template v-else-if="key === 'privacy'">
          <p class="border-s-4 border-warning ps-3">
            {{ $t('admin.pages.privacy.factsNote') }}
          </p>
          <UiField
            v-slot="field"
            :label="$t('admin.pages.privacy.updatedOn')"
          >
            <UiInput
              :model-value="draft.blocks.updatedOn ?? ''"
              v-bind="field"
              type="date"
              @update:model-value="draft.blocks.updatedOn = $event || null"
            />
          </UiField>
          <div class="grid gap-2">
            <p class="font-strong">
              {{ $t('admin.pages.privacy.body') }}
            </p>
            <ContentEditor
              :key="editorKey"
              v-model="document"
              :label="$t('admin.pages.privacy.body')"
              @edit="documentEdited = true"
            />
          </div>
        </template>

        <!-- Blog and projects indexes -->
        <template v-else>
          <UiField
            v-slot="field"
            :label="$t('admin.pages.index.title')"
            :description="$t('admin.pages.index.titleHint')"
          >
            <UiInput
              v-model="draft.blocks.title"
              v-bind="field"
              :maxlength="120"
            />
          </UiField>
          <UiField
            v-slot="field"
            :label="$t('admin.pages.index.intro')"
          >
            <UiTextarea
              v-model="draft.blocks.intro"
              v-bind="field"
              :maxlength="400"
              :rows="3"
            />
          </UiField>
        </template>
      </section>

      <section
        class="grid max-w-3xl gap-6"
        aria-labelledby="page-seo"
      >
        <UiHeading
          id="page-seo"
          :level="2"
          :size="3"
        >
          {{ $t('admin.articles.edit.seo') }}
        </UiHeading>
        <UiField
          v-slot="field"
          :label="$t('admin.articles.edit.seoTitle')"
          :description="$t('admin.articles.edit.seoTitleHint')"
        >
          <UiInput
            v-model="draft.seoTitle"
            v-bind="field"
            :maxlength="200"
          />
        </UiField>
        <UiField
          v-slot="field"
          :label="$t('admin.articles.edit.seoDescription')"
          :description="$t('admin.articles.edit.seoDescriptionHint')"
        >
          <UiTextarea
            v-model="draft.seoDescription"
            v-bind="field"
            :maxlength="500"
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
        />
        <label class="inline-flex min-h-(--target-min) items-center gap-2">
          <input
            v-model="draft.noindex"
            type="checkbox"
            class="size-5 accent-accent"
          >
          {{ $t('admin.articles.edit.noindex') }}
        </label>
      </section>

      <section
        class="grid max-w-3xl gap-4"
        aria-labelledby="page-publish"
      >
        <UiHeading
          id="page-publish"
          :level="2"
          :size="3"
        >
          {{ $t('admin.publish.title') }}
        </UiHeading>
        <PublishPanel
          :api-base="apiBase"
          resource="page"
          :copy="copy"
          :changed="unpublishedChanges"
          :before-action="saveBeforeAction"
          @updated="page = $event as unknown as PageDetail"
          @conflict="openConflict"
        />
      </section>

      <section
        class="grid gap-4"
        aria-labelledby="page-history"
      >
        <UiHeading
          id="page-history"
          :level="2"
          :size="3"
        >
          {{ $t('admin.history.title') }}
        </UiHeading>
        <details class="grid gap-4">
          <summary class="inline-flex min-h-(--target-min) cursor-pointer items-center font-strong underline underline-offset-(--underline-offset)">
            {{ $t('admin.history.open') }}
          </summary>
          <HistoryPanel
            class="mt-4"
            :api-base="apiBase"
            resource="page"
            :current="fieldsOf(draft)"
            :topics="[]"
            :fields="diffFields"
            :to-fields="revisionFields"
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
        </div>
        <UiStatusMessage
          v-if="status"
          :tone="status.tone"
        >
          {{ status.text }}
        </UiStatusMessage>
      </div>
    </form>

    <SaveVersionDialog
      ref="versionDialog"
      @save="saveVersion"
    />
    <ConflictDialog
      ref="conflictDialog"
      :theirs="conflict?.theirFields ?? null"
      :mine="conflict?.mine ?? null"
      :topics="[]"
      :fields="diffFields"
      @keep-mine="keepMine"
      @use-theirs="useTheirs"
    />
  </div>
</template>
