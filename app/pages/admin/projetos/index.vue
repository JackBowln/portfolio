<script setup lang="ts">
// Projects (F07-T1, RF-09.2): the list in its manual order, which "up" and "down" change (buttons, so the keyboard
// works; the order is saved at once for the whole list), whether each one is featured on the home, and "new
// project" from a title alone, which opens the editor. Reordering needs project:publish; the server decides
import { can } from '#shared/auth/permissions'
import { PROJECT_LIMITS } from '#shared/content/project-input'
import { SOURCE_LOCALE } from '#shared/types/enums'
import { apiError } from '~/utils/admin/articles'
import { formatDateTime } from '~/utils/admin/format'
import type { ProjectDetail, ProjectListItem } from '~/utils/admin/projects'
import { adminFetch, useAdminUser } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const user = useAdminUser()
const role = computed(() => user.value?.role ?? '')
const canCreate = computed(() => can(role.value, { project: ['create'] }))
const canReorder = computed(() => can(role.value, { project: ['publish'] }))
const items = ref<ProjectListItem[]>([])
const loaded = ref(false)
const failed = ref(false)
const busy = ref(false)
const title = ref('')
const createError = ref<string>()
const status = ref<{ tone: 'success' | 'danger', text: string }>()

async function load() {
  failed.value = false
  try {
    items.value = (await adminFetch<{ items: ProjectListItem[] }>('/api/admin/projects')).items
    loaded.value = true
  }
  catch {
    failed.value = true
  }
}
onMounted(load)

async function create() {
  createError.value = undefined
  if (title.value.trim() === '') {
    createError.value = t('admin.articles.edit.titleRequired')
    return
  }
  try {
    const project = await adminFetch<ProjectDetail>('/api/admin/projects', { method: 'POST', body: { title: title.value } })
    await navigateTo(`/admin/projetos/${project.id}`)
  }
  catch {
    createError.value = t('admin.projects.create.failed')
  }
}

const source = (item: ProjectListItem) => item.localizations.find(localization => localization.locale === SOURCE_LOCALE) ?? item.localizations[0]

async function move(index: number, by: -1 | 1) {
  if (busy.value) {
    return
  }
  const ids = items.value.map(item => item.id)
  const [id] = ids.splice(index, 1)
  ids.splice(index + by, 0, id!)
  busy.value = true
  status.value = undefined
  try {
    items.value = (await adminFetch<{ items: ProjectListItem[] }>('/api/admin/projects/order', { method: 'PUT', body: { ids } })).items
    const moved = items.value[index + by]
    status.value = { tone: 'success', text: t('admin.projects.order.moved', { title: moved ? source(moved)?.title ?? '' : '', position: index + by + 1 }) }
  }
  catch (error) {
    const { status: code } = apiError(error)
    status.value = { tone: 'danger', text: code === 409 ? t('admin.projects.order.stale') : code === 403 ? t('admin.projects.order.forbidden') : t('admin.common.unexpectedError') }
    if (code === 409) {
      await load()
    }
  }
  finally {
    busy.value = false
  }
}

useHead({ title: () => t('admin.projects.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid grid-cols-1 gap-10">
    <div class="grid gap-3">
      <UiHeading
        :level="1"
        :size="4"
      >
        {{ $t('admin.projects.title') }}
      </UiHeading>
      <p class="text-text-muted">
        {{ $t('admin.projects.intro') }}
      </p>
    </div>

    <section
      v-if="canCreate"
      class="grid max-w-xl gap-4"
      aria-labelledby="project-create"
    >
      <UiHeading
        id="project-create"
        :level="2"
        :size="3"
      >
        {{ $t('admin.projects.create.title') }}
      </UiHeading>
      <form
        class="flex flex-wrap items-end gap-3"
        novalidate
        @submit.prevent="create"
      >
        <UiField
          v-slot="field"
          class="min-w-[min(100%,20rem)] flex-1"
          :label="$t('admin.projects.create.label')"
          :error="createError"
          required
        >
          <UiInput
            v-model="title"
            v-bind="field"
            :maxlength="PROJECT_LIMITS.title"
          />
        </UiField>
        <UiButton type="submit">
          {{ $t('admin.projects.create.submit') }}
        </UiButton>
      </form>
    </section>

    <UiStatusMessage
      v-if="status"
      :tone="status.tone"
    >
      {{ status.text }}
    </UiStatusMessage>
    <UiStatusMessage
      v-if="failed"
      tone="danger"
    >
      {{ $t('admin.common.unexpectedError') }}
    </UiStatusMessage>
    <p v-else-if="loaded && items.length === 0">
      {{ $t('admin.projects.empty') }}
    </p>
    <ol
      v-else-if="items.length > 0"
      class="grid gap-2"
      :aria-label="$t('admin.projects.order.label')"
    >
      <li
        v-for="(item, index) in items"
        :key="item.id"
        class="grid gap-2 border-b border-border py-3 sm:grid-cols-[1fr_auto] sm:items-center"
        data-testid="project-row"
      >
        <div class="grid gap-1">
          <p class="font-strong">
            <span class="text-text-muted">{{ index + 1 }}.</span>
            <NuxtLink
              :to="`/admin/projetos/${item.id}`"
              class="underline underline-offset-(--underline-offset) hover:text-accent"
            >
              {{ source(item)?.title || $t('admin.articles.untitled') }}
            </NuxtLink>
          </p>
          <p class="text-step--1 text-text-muted">
            {{ $t(`admin.articles.statuses.${source(item)?.status ?? 'draft'}`) }}
            <template v-if="item.featured">
              · {{ $t('admin.projects.featuredBadge') }}
            </template>
            · {{ $t('admin.projects.meta', { author: item.authorName ?? $t('admin.history.unknownAuthor'), date: formatDateTime(item.updatedAt) }) }}
          </p>
        </div>
        <div
          v-if="canReorder"
          class="flex flex-wrap gap-2"
        >
          <UiButton
            variant="secondary"
            size="sm"
            :disabled="busy || index === 0"
            :aria-label="$t('admin.projects.order.upLabel', { title: source(item)?.title ?? '' })"
            @click="move(index, -1)"
          >
            {{ $t('admin.projects.order.up') }}
          </UiButton>
          <UiButton
            variant="secondary"
            size="sm"
            :disabled="busy || index === items.length - 1"
            :aria-label="$t('admin.projects.order.downLabel', { title: source(item)?.title ?? '' })"
            @click="move(index, 1)"
          >
            {{ $t('admin.projects.order.down') }}
          </UiButton>
        </div>
      </li>
    </ol>
  </div>
</template>
