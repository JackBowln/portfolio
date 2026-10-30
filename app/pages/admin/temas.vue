<script setup lang="ts">
// Topics (F06-T1): create, rename and delete. Renaming changes every article that uses the topic and deleting is
// refused while articles use it (decision 3), so those two need tag:update/delete; the server decides, the screen
// only hides what the role cannot do
import { can } from '#shared/auth/permissions'
import { TAG_NAME_MAX } from '#shared/content/article-input'
import ConfirmDialog from '~/components/admin/ConfirmDialog.vue'
import type { TopicItem } from '~/utils/admin/articles'
import { apiError } from '~/utils/admin/articles'
import { adminFetch, useAdminUser } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const user = useAdminUser()
const role = computed(() => user.value?.role ?? '')
const topics = ref<TopicItem[]>([])
const names = ref<Record<string, string>>({})
const loaded = ref(false)
const newName = ref('')
const createError = ref<string>()
const status = ref<{ tone: 'success' | 'danger', text: string }>()
const pending = ref<TopicItem>()
const confirm = useTemplateRef<InstanceType<typeof ConfirmDialog>>('confirm')

async function load() {
  const { items } = await adminFetch<{ items: TopicItem[] }>('/api/admin/tags')
  topics.value = items
  names.value = Object.fromEntries(items.map(item => [item.id, item.name]))
  loaded.value = true
}
onMounted(load)

function failure(error: unknown, inUse?: TopicItem): string {
  const { status: code } = apiError(error)
  if (code === 409 && inUse) {
    return t('admin.tags.inUse', { count: inUse.uses }, inUse.uses)
  }
  if (code === 409) {
    return t('admin.tags.slugTaken')
  }
  if (code === 403) {
    return t('admin.tags.forbidden')
  }
  return code === 400 ? t('admin.tags.invalidName') : t('admin.common.unexpectedError')
}

async function create() {
  createError.value = undefined
  status.value = undefined
  try {
    const topic = await adminFetch<Omit<TopicItem, 'uses'>>('/api/admin/tags', { method: 'POST', body: { name: newName.value } })
    newName.value = ''
    await load()
    status.value = { tone: 'success', text: t('admin.tags.created', { name: topic.name }) }
  }
  catch (error) {
    createError.value = failure(error)
  }
}

async function rename(topic: TopicItem) {
  status.value = undefined
  try {
    await adminFetch(`/api/admin/tags/${encodeURIComponent(topic.id)}`, { method: 'PATCH', body: { name: names.value[topic.id] } })
    await load()
    status.value = { tone: 'success', text: t('admin.tags.renamed') }
  }
  catch (error) {
    status.value = { tone: 'danger', text: failure(error) }
  }
}

function askDelete(topic: TopicItem) {
  pending.value = topic
  confirm.value?.open()
}

async function remove() {
  const topic = pending.value
  if (!topic) {
    return
  }
  status.value = undefined
  try {
    await adminFetch(`/api/admin/tags/${encodeURIComponent(topic.id)}`, { method: 'DELETE' })
    await load()
    status.value = { tone: 'success', text: t('admin.tags.deleted') }
  }
  catch (error) {
    status.value = { tone: 'danger', text: failure(error, topic) }
  }
}

useHead({ title: () => t('admin.tags.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid grid-cols-1 gap-10">
    <div class="grid gap-3">
      <UiHeading
        :level="1"
        :size="4"
      >
        {{ $t('admin.tags.title') }}
      </UiHeading>
      <p class="text-text-muted">
        {{ $t('admin.tags.intro') }}
      </p>
    </div>

    <section
      v-if="can(role, { tag: ['create'] })"
      class="grid max-w-xl gap-4"
      aria-labelledby="tag-create"
    >
      <UiHeading
        id="tag-create"
        :level="2"
        :size="3"
      >
        {{ $t('admin.tags.create') }}
      </UiHeading>
      <form
        class="flex flex-wrap items-end gap-3"
        novalidate
        @submit.prevent="create"
      >
        <UiField
          v-slot="field"
          class="min-w-[min(100%,20rem)] flex-1"
          :label="$t('admin.tags.name')"
          :error="createError"
          required
        >
          <UiInput
            v-model="newName"
            v-bind="field"
            :maxlength="TAG_NAME_MAX"
          />
        </UiField>
        <UiButton
          type="submit"
          :disabled="newName.trim() === ''"
        >
          {{ $t('admin.tags.add') }}
        </UiButton>
      </form>
    </section>

    <UiStatusMessage
      v-if="status"
      :tone="status.tone"
    >
      {{ status.text }}
    </UiStatusMessage>

    <p v-if="loaded && topics.length === 0">
      {{ $t('admin.tags.empty') }}
    </p>
    <div
      v-else-if="topics.length > 0"
      class="overflow-x-auto"
      role="group"
      tabindex="0"
      :aria-label="$t('admin.tags.table.caption')"
    >
      <table class="w-full border-collapse text-step--1">
        <caption class="sr-only">
          {{ $t('admin.tags.table.caption') }}
        </caption>
        <thead>
          <tr class="border-b border-border">
            <th
              scope="col"
              class="py-2 pe-4 text-start"
            >
              {{ $t('admin.tags.table.name') }}
            </th>
            <th
              scope="col"
              class="py-2 pe-4 text-start"
            >
              {{ $t('admin.tags.table.slug') }}
            </th>
            <th
              scope="col"
              class="py-2 pe-4 text-start"
            >
              {{ $t('admin.tags.table.uses') }}
            </th>
            <th
              scope="col"
              class="py-2 text-start"
            >
              {{ $t('admin.tags.table.actions') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="topic in topics"
            :key="topic.id"
            class="border-b border-border align-middle"
            data-testid="topic-row"
          >
            <th
              scope="row"
              class="py-3 pe-4 text-start font-strong"
            >
              {{ topic.name }}
            </th>
            <td class="py-3 pe-4 font-mono">
              {{ topic.slug }}
            </td>
            <td class="py-3 pe-4">
              {{ topic.uses }}
            </td>
            <td class="py-3">
              <div class="flex flex-wrap items-center gap-2">
                <template v-if="can(role, { tag: ['update'] })">
                  <label
                    class="sr-only"
                    :for="`topic-name-${topic.id}`"
                  >{{ $t('admin.tags.rename', { name: topic.name }) }}</label>
                  <input
                    :id="`topic-name-${topic.id}`"
                    v-model="names[topic.id]"
                    class="min-h-(--target-min) w-48 border border-border bg-bg px-2"
                    :maxlength="TAG_NAME_MAX"
                  >
                  <UiButton
                    variant="secondary"
                    size="sm"
                    :disabled="!names[topic.id]?.trim() || names[topic.id] === topic.name"
                    @click="rename(topic)"
                  >
                    {{ $t('admin.tags.renameSave') }}
                  </UiButton>
                </template>
                <UiButton
                  v-if="can(role, { tag: ['delete'] })"
                  variant="ghost"
                  size="sm"
                  :aria-label="$t('admin.tags.delete', { name: topic.name })"
                  @click="askDelete(topic)"
                >
                  {{ $t('admin.articles.edit.deleteConfirm') }}
                </UiButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmDialog
      ref="confirm"
      :title="$t('admin.tags.delete', { name: pending?.name ?? '' })"
      :text="$t('admin.tags.intro')"
      :confirm-label="$t('admin.articles.edit.deleteConfirm')"
      @confirm="remove"
    />
  </div>
</template>
