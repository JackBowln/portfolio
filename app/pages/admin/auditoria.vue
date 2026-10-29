<script setup lang="ts">
// Audit log (RF-02.4): who did what, and when, filtered by period, actor and action. The server checks audit:read
// and never sends the IP hash; this page only reads
import { AUDIT_ACTIONS } from '#shared/audit/actions'
import { formatDateTime } from '~/utils/admin/format'
import { adminFetch } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

interface AuditEntry {
  id: string
  createdAt: string
  action: string
  actor: { id: string, name: string | null } | null
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown> | null
}

interface AuditPage {
  entries: AuditEntry[]
  nextCursor: string | null
  actors: { id: string, name: string }[]
}

const SELECT_CLASS = 'min-h-(--target-comfortable) w-full rounded-control border border-border bg-bg px-3 text-text hover:border-text'

const { t } = useI18n()
const filters = reactive({ from: '', to: '', actor: '', action: '' })
const entries = ref<AuditEntry[]>([])
const actors = ref<AuditPage['actors']>([])
const nextCursor = ref<string | null>(null)
const loaded = ref(false)
const busy = ref(false)
const error = ref('')

async function fetchPage(cursor?: string) {
  busy.value = true
  error.value = ''
  try {
    const query = Object.fromEntries(Object.entries({ ...filters, cursor }).filter(([, value]) => value))
    const page = await adminFetch<AuditPage>('/api/admin/audit', { query })
    entries.value = cursor ? [...entries.value, ...page.entries] : page.entries
    actors.value = page.actors
    nextCursor.value = page.nextCursor
    loaded.value = true
  }
  catch {
    error.value = t('admin.common.unexpectedError')
  }
  finally {
    busy.value = false
  }
}

onMounted(() => fetchPage())

const actorLabel = (entry: AuditEntry) => entry.actor ? (entry.actor.name || entry.actor.id) : t('admin.audit.system')
const details = (entry: AuditEntry) => Object.entries(entry.metadata ?? {}).map(([key, value]) => `${key}: ${String(value)}`).join(', ')

useHead({ title: () => t('admin.audit.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid gap-6">
    <UiHeading :level="1">
      {{ $t('admin.audit.title') }}
    </UiHeading>
    <p>{{ $t('admin.audit.intro') }}</p>

    <form
      class="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-5"
      :aria-label="$t('admin.audit.filters')"
      @submit.prevent="fetchPage()"
    >
      <UiField
        v-slot="field"
        :label="$t('admin.audit.from')"
      >
        <UiInput
          v-bind="field"
          v-model="filters.from"
          type="date"
        />
      </UiField>
      <UiField
        v-slot="field"
        :label="$t('admin.audit.to')"
      >
        <UiInput
          v-bind="field"
          v-model="filters.to"
          type="date"
        />
      </UiField>
      <UiField
        v-slot="field"
        :label="$t('admin.audit.actor')"
      >
        <select
          :id="field.id"
          v-model="filters.actor"
          :class="SELECT_CLASS"
        >
          <option value="">
            {{ $t('admin.audit.anyActor') }}
          </option>
          <option
            v-for="actor in actors"
            :key="actor.id"
            :value="actor.id"
          >
            {{ actor.name || actor.id }}
          </option>
        </select>
      </UiField>
      <UiField
        v-slot="field"
        :label="$t('admin.audit.action')"
      >
        <select
          :id="field.id"
          v-model="filters.action"
          :class="SELECT_CLASS"
        >
          <option value="">
            {{ $t('admin.audit.anyAction') }}
          </option>
          <option
            v-for="action in AUDIT_ACTIONS"
            :key="action"
            :value="action"
          >
            {{ action }}
          </option>
        </select>
      </UiField>
      <div>
        <UiButton
          type="submit"
          :disabled="busy"
        >
          {{ $t('admin.audit.apply') }}
        </UiButton>
      </div>
    </form>

    <UiStatusMessage
      v-if="error"
      tone="danger"
    >
      {{ error }}
    </UiStatusMessage>

    <template v-if="loaded">
      <p v-if="entries.length === 0">
        {{ $t('admin.audit.empty') }}
      </p>
      <div
        v-else
        class="overflow-x-auto"
      >
        <table class="w-full text-left text-step--1">
          <caption class="sr-only">
            {{ $t('admin.audit.title') }}
          </caption>
          <thead>
            <tr class="border-b border-border">
              <th
                scope="col"
                class="py-2 pr-4"
              >
                {{ $t('admin.audit.when') }}
              </th>
              <th
                scope="col"
                class="py-2 pr-4"
              >
                {{ $t('admin.audit.who') }}
              </th>
              <th
                scope="col"
                class="py-2 pr-4"
              >
                {{ $t('admin.audit.what') }}
              </th>
              <th
                scope="col"
                class="py-2 pr-4"
              >
                {{ $t('admin.audit.entity') }}
              </th>
              <th
                scope="col"
                class="py-2"
              >
                {{ $t('admin.audit.details') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in entries"
              :key="entry.id"
              class="border-b border-border align-top"
              data-testid="audit-row"
            >
              <td class="py-2 pr-4 whitespace-nowrap">
                {{ formatDateTime(entry.createdAt) }}
              </td>
              <td class="py-2 pr-4">
                {{ actorLabel(entry) }}
              </td>
              <td class="py-2 pr-4">
                <code>{{ entry.action }}</code>
              </td>
              <td class="py-2 pr-4 break-all">
                {{ entry.entityType ? `${entry.entityType}${entry.entityId ? ` ${entry.entityId}` : ''}` : '—' }}
              </td>
              <td class="py-2 break-all">
                {{ details(entry) || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="nextCursor">
        <UiButton
          variant="secondary"
          :disabled="busy"
          @click="fetchPage(nextCursor)"
        >
          {{ $t('admin.audit.more') }}
        </UiButton>
      </div>
    </template>
  </div>
</template>
