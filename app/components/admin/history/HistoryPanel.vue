<script setup lang="ts">
// Admin-only. An article's or a project's history (F06-T2, F07-T1, RF-05.5–RF-05.6), from the item's API (`apiBase`): every revision with its kind, note, author and time,
// newest first; "compare" shows what changed from that revision to the current text, and "restore" brings it back
// after a confirmation (a new `restore` revision; nothing is deleted). Loaded when opened
import { can } from '#shared/auth/permissions'
import ConfirmDialog from '~/components/admin/ConfirmDialog.vue'
import type { TopicItem } from '~/utils/admin/articles'
import { DIFF_FIELDS } from '~/utils/admin/document-diff'
import type { AnyVersionFields, DiffField } from '~/utils/admin/document-diff'
import { formatDateTime } from '~/utils/admin/format'
import type { RevisionDetail, RevisionItem } from '~/utils/admin/revisions'
import { versionFieldsOf } from '~/utils/admin/revisions'
import { adminFetch, useAdminUser } from '~/utils/admin/session'
import RevisionDiff from './RevisionDiff.vue'

const props = withDefaults(defineProps<{
  /** The item's admin API, e.g. /api/admin/articles/{id} */
  apiBase: string
  resource?: 'article' | 'project' | 'page'
  current: AnyVersionFields
  topics: TopicItem[]
  fields?: readonly DiffField[]
  refresh: number
  /** How a revision's snapshot reads as the compared fields; a page flattens its blocks (F08-T2) */
  toFields?: (snapshot: RevisionDetail['snapshot']) => AnyVersionFields
}>(), { resource: 'article', fields: () => DIFF_FIELDS, toFields: versionFieldsOf })
const emit = defineEmits<{ restore: [revision: RevisionItem] }>()

const { t } = useI18n()
const user = useAdminUser()
const canRestore = computed(() => can(user.value?.role ?? '', { [props.resource]: ['restore'] }))
const revisions = ref<RevisionItem[]>([])
const loaded = ref(false)
const failed = ref(false)
const compared = ref<{ revision: RevisionItem, fields: AnyVersionFields } | null>(null)
const pending = ref<RevisionItem>()
const confirm = useTemplateRef<InstanceType<typeof ConfirmDialog>>('confirm')

async function load() {
  failed.value = false
  try {
    revisions.value = (await adminFetch<{ items: RevisionItem[] }>(`${props.apiBase}/revisions`)).items
    loaded.value = true
  }
  catch {
    failed.value = true
  }
}
onMounted(load)
watch(() => props.refresh, load)

async function compare(revision: RevisionItem) {
  const detail = await adminFetch<RevisionDetail>(`${props.apiBase}/revisions/${encodeURIComponent(revision.id)}`)
  compared.value = { revision, fields: props.toFields(detail.snapshot) }
}

function askRestore(revision: RevisionItem) {
  pending.value = revision
  confirm.value?.open()
}

const label = (revision: RevisionItem) => t('admin.history.item', { number: revision.number, kind: t(`admin.history.kinds.${revision.kind}`) })
</script>

<template>
  <div class="grid gap-4">
    <UiStatusMessage
      v-if="failed"
      tone="danger"
    >
      {{ $t('admin.common.unexpectedError') }}
    </UiStatusMessage>
    <p v-else-if="loaded && revisions.length === 0">
      {{ $t('admin.history.empty') }}
    </p>
    <ol
      v-else
      class="grid gap-2"
      data-testid="history-list"
    >
      <li
        v-for="revision in revisions"
        :key="revision.id"
        class="grid gap-2 border-b border-border py-2 sm:grid-cols-[1fr_auto] sm:items-center"
      >
        <div class="grid gap-1">
          <p class="font-strong">
            {{ label(revision) }}
          </p>
          <p
            v-if="revision.note"
            class="break-words"
          >
            “{{ revision.note }}”
          </p>
          <p class="text-step--1 text-text-muted">
            {{ $t('admin.history.meta', { author: revision.authorName ?? $t('admin.history.unknownAuthor'), date: formatDateTime(revision.createdAt) }) }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UiButton
            variant="secondary"
            size="sm"
            :aria-label="$t('admin.history.compareLabel', { item: label(revision) })"
            @click="compare(revision)"
          >
            {{ $t('admin.history.compare') }}
          </UiButton>
          <UiButton
            v-if="canRestore"
            variant="ghost"
            size="sm"
            :aria-label="$t('admin.history.restoreLabel', { item: label(revision) })"
            @click="askRestore(revision)"
          >
            {{ $t('admin.history.restore') }}
          </UiButton>
        </div>
      </li>
    </ol>

    <section
      v-if="compared"
      class="grid gap-3 border border-border p-4"
      aria-labelledby="history-compare"
    >
      <UiHeading
        id="history-compare"
        :level="3"
        :size="2"
      >
        {{ $t('admin.history.compareTitle', { item: label(compared.revision) }) }}
      </UiHeading>
      <RevisionDiff
        :before="compared.fields"
        :after="current"
        :before-label="label(compared.revision)"
        :after-label="$t('admin.history.currentText')"
        :topics="topics"
        :fields="fields"
      />
    </section>

    <ConfirmDialog
      ref="confirm"
      :title="pending ? $t('admin.history.restoreTitle', { item: label(pending) }) : ''"
      :text="$t('admin.history.restoreText')"
      :confirm-label="$t('admin.history.restore')"
      @confirm="pending && emit('restore', pending)"
    />
  </div>
</template>
