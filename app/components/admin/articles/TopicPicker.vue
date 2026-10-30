<script setup lang="ts">
// Admin-only. An article's topics or a project's technologies (`kind`, F07-T1) as checkboxes, kept in the order they
// were ticked, plus a field to create one and tick it at once for roles with tag:create (the server decides; this
// only hides the field)
import { can } from '#shared/auth/permissions'
import { ARTICLE_LIMITS, TAG_NAME_MAX } from '#shared/content/article-input'
import type { TagKind } from '#shared/types/enums'
import type { TopicItem } from '~/utils/admin/articles'
import { apiError, hasIssue } from '~/utils/admin/articles'
import { adminFetch, useAdminUser } from '~/utils/admin/session'

const model = defineModel<string[]>({ required: true })
const props = withDefaults(defineProps<{ topics: TopicItem[], kind?: TagKind, max?: number }>(), { kind: 'topic', max: ARTICLE_LIMITS.tags })
// Topic texts live under admin.tags, technology texts under admin.technologies
const keys = computed(() => (props.kind === 'topic' ? 'admin.tags' : 'admin.technologies'))
const emit = defineEmits<{ created: [topic: TopicItem] }>()

const { t } = useI18n()
const user = useAdminUser()
const canCreate = computed(() => can(user.value?.role ?? '', { tag: ['create'] }))
const name = ref('')
const error = ref<string>()

function toggle(id: string, checked: boolean) {
  model.value = checked ? [...model.value, id] : model.value.filter(item => item !== id)
}

async function create() {
  error.value = undefined
  try {
    const topic = await adminFetch<Omit<TopicItem, 'uses'>>('/api/admin/tags', { method: 'POST', body: { name: name.value, kind: props.kind } })
    emit('created', { ...topic, uses: 0 })
    model.value = [...model.value, topic.id]
    name.value = ''
  }
  catch (failure) {
    const { status, issues } = apiError(failure)
    error.value = status === 409 ? t('admin.tags.slugTaken') : hasIssue(issues, 'slug') || hasIssue(issues, 'name') ? t('admin.tags.invalidName') : t('admin.common.unexpectedError')
  }
}
</script>

<template>
  <fieldset class="grid gap-3">
    <legend class="font-strong">
      {{ $t(`${keys}.pickerLegend`) }}
    </legend>
    <p
      v-if="props.topics.length === 0"
      class="text-text-muted"
    >
      {{ $t(`${keys}.pickerEmpty`) }}
    </p>
    <ul
      v-else
      class="flex flex-wrap gap-x-6 gap-y-2"
    >
      <li
        v-for="topic in props.topics"
        :key="topic.id"
      >
        <label class="inline-flex min-h-(--target-min) items-center gap-2">
          <input
            type="checkbox"
            class="size-5 accent-accent"
            :checked="model.includes(topic.id)"
            :disabled="!model.includes(topic.id) && model.length >= props.max"
            @change="toggle(topic.id, ($event.target as HTMLInputElement).checked)"
          >
          {{ topic.name }}
        </label>
      </li>
    </ul>
    <!-- Not a <form>: the picker sits inside the item's form; Enter creates the tag instead of saving -->
    <div
      v-if="canCreate"
      class="flex flex-wrap items-end gap-3"
      @keydown.enter.prevent="name.trim() && create()"
    >
      <UiField
        v-slot="field"
        :label="$t(`${keys}.pickerNew`)"
        :error="error"
      >
        <UiInput
          v-model="name"
          v-bind="field"
          :maxlength="TAG_NAME_MAX"
        />
      </UiField>
      <UiButton
        variant="secondary"
        :disabled="name.trim() === ''"
        @click="create"
      >
        {{ $t('admin.tags.pickerAdd') }}
      </UiButton>
    </div>
  </fieldset>
</template>
