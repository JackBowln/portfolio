<script setup lang="ts">
// Admin-only. What changed from one version to another (utils/admin/document-diff.ts): the fields of the type
// (`fields`, an article's by default), then the body's
// changed blocks with the words added and removed. Insertions and deletions are words for screen readers as well
// as colors and strikes (WCAG 1.4.1)
import type { TopicItem } from '~/utils/admin/articles'
import { DIFF_FIELDS, diffVersions } from '~/utils/admin/document-diff'
import type { AnyVersionFields, DiffField } from '~/utils/admin/document-diff'

const props = withDefaults(defineProps<{
  before: AnyVersionFields
  after: AnyVersionFields
  beforeLabel: string
  afterLabel: string
  /** Names of the tags the fields refer to (topics, technologies) */
  topics: TopicItem[]
  fields?: readonly DiffField[]
}>(), { fields: () => DIFF_FIELDS })
const { t } = useI18n()

const diff = computed(() => diffVersions(props.before, props.after, props.fields))
const changedBlocks = computed(() => diff.value.blocks.filter(block => block.status !== 'same'))

function show(field: DiffField, value: unknown): string {
  if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
    return t('admin.history.diff.empty')
  }
  if (field === 'tagIds' || field === 'technologyIds') {
    return (value as string[]).map(id => props.topics.find(topic => topic.id === id)?.name ?? t('admin.history.diff.deletedTopic')).join(', ')
  }
  if (field === 'galleryMediaIds') {
    return t('admin.history.diff.images', { count: (value as string[]).length }, (value as string[]).length)
  }
  if (field === 'highlights') {
    return (value as { label: string, value: string }[]).map(item => `${item.label}: ${item.value}`).join(' · ')
  }
  if (field === 'noindex') {
    return value ? t('admin.history.diff.yes') : t('admin.history.diff.no')
  }
  if (field === 'coverMediaId' || field === 'ogImageMediaId') {
    return t('admin.history.diff.image')
  }
  // A list or a group of fields (a page's blocks, F08-T2, decision 3): which block changed, not how
  if (typeof value === 'object') {
    return t('admin.history.diff.changedValue')
  }
  return String(value)
}
</script>

<template>
  <div
    class="grid gap-6"
    data-testid="revision-diff"
  >
    <p
      v-if="diff.identical"
      class="text-text-muted"
    >
      {{ $t('admin.history.diff.identical') }}
    </p>
    <template v-else>
      <p class="text-step--1 text-text-muted">
        {{ $t('admin.history.diff.direction', { before: beforeLabel, after: afterLabel }) }}
      </p>
      <section
        v-if="diff.fields.length > 0"
        class="grid gap-2"
      >
        <UiHeading
          :level="4"
          :size="1"
        >
          {{ $t('admin.history.diff.fields') }}
        </UiHeading>
        <dl class="grid gap-3">
          <div
            v-for="change in diff.fields"
            :key="change.field"
            class="grid gap-1 border-b border-border pb-2"
          >
            <dt class="font-strong">
              {{ $t(`admin.history.fields.${change.field}`) }}
            </dt>
            <dd class="grid gap-1 text-step--1 break-words">
              <span><del class="text-danger">
                <span class="sr-only">{{ $t('admin.history.diff.removed') }}: </span>{{ show(change.field, change.before) }}
              </del></span>
              <span><ins class="text-success no-underline">
                <span class="sr-only">{{ $t('admin.history.diff.added') }}: </span>{{ show(change.field, change.after) }}
              </ins></span>
            </dd>
          </div>
        </dl>
      </section>
      <section
        v-if="changedBlocks.length > 0"
        class="grid gap-2"
      >
        <UiHeading
          :level="4"
          :size="1"
        >
          {{ $t('admin.history.diff.body', { count: changedBlocks.length }, changedBlocks.length) }}
        </UiHeading>
        <ol class="grid gap-3">
          <li
            v-for="block in changedBlocks"
            :key="`${block.status}:${block.id}`"
            class="grid gap-1 border-s-4 ps-3"
            :class="{
              'border-success': block.status === 'added',
              'border-danger': block.status === 'removed',
              'border-warning': block.status === 'changed' || block.status === 'moved',
            }"
            :data-status="block.status"
          >
            <p class="text-step--1 font-strong">
              {{ $t(`admin.history.status.${block.status}`) }} · {{ $t(`admin.history.blockTypes.${block.type}`) }}
            </p>
            <p
              v-if="block.words"
              class="text-step--1 break-words whitespace-pre-wrap"
            >
              <template
                v-for="(part, index) in block.words"
                :key="index"
              >
                <ins
                  v-if="part.added"
                  class="bg-success/15 text-success no-underline"
                ><span class="sr-only">{{ $t('admin.history.diff.added') }}: </span>{{ part.value }}</ins><del
                  v-else-if="part.removed"
                  class="bg-danger/15 text-danger"
                ><span class="sr-only">{{ $t('admin.history.diff.removed') }}: </span>{{ part.value }}</del><span v-else>{{ part.value }}</span>
              </template>
            </p>
            <p
              v-else
              class="text-step--1 break-words whitespace-pre-wrap"
              :class="{ 'line-through': block.status === 'removed' }"
            >
              {{ (block.status === 'removed' ? block.before : block.after) || $t('admin.history.diff.noText') }}
            </p>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>
