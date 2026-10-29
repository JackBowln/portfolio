<script setup lang="ts">
// Own sessions (RF-03.5): list and revoke the others. The server lists only this user's sessions, never their
// tokens, and refuses to revoke the current one (sign out instead)
import { formatDateTime } from '~/utils/admin/format'
import { adminFetch } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

interface SessionRow {
  id: string
  current: boolean
  userAgent: string | null
  createdAt: string
  lastUsedAt: string
  expiresAt: string
}

const { t } = useI18n()
const sessions = ref<SessionRow[]>([])
const loaded = ref(false)
const busy = ref(false)
const status = ref<{ tone: 'success' | 'danger', text: string }>()

async function load() {
  const result = await adminFetch<{ sessions: SessionRow[] }>('/api/admin/sessions')
  sessions.value = result.sessions
  loaded.value = true
}

onMounted(load)

async function revoke(id: string) {
  busy.value = true
  try {
    await adminFetch(`/api/admin/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
    status.value = { tone: 'success', text: t('admin.sessions.revoked') }
    await load()
  }
  catch {
    status.value = { tone: 'danger', text: t('admin.common.unexpectedError') }
  }
  finally {
    busy.value = false
  }
}

const device = (session: SessionRow) => session.userAgent || t('admin.sessions.unknownDevice')

useHead({ title: () => t('admin.sessions.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid gap-6">
    <UiHeading :level="1">
      {{ $t('admin.sessions.title') }}
    </UiHeading>
    <p>{{ $t('admin.sessions.intro') }}</p>

    <template v-if="loaded">
      <p v-if="sessions.length === 0">
        {{ $t('admin.sessions.empty') }}
      </p>
      <ul
        v-else
        class="grid gap-3"
      >
        <li
          v-for="session in sessions"
          :key="session.id"
          class="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3"
          data-testid="session-row"
        >
          <span class="grid gap-1">
            <span class="font-strong break-all">
              {{ device(session) }}
              <UiTag v-if="session.current">{{ $t('admin.sessions.current') }}</UiTag>
            </span>
            <span class="text-step--1 text-text-muted">
              {{ $t('admin.sessions.details', { created: formatDateTime(session.createdAt), used: formatDateTime(session.lastUsedAt), expires: formatDateTime(session.expiresAt) }) }}
            </span>
          </span>
          <span
            v-if="session.current"
            class="text-step--1 text-text-muted"
          >{{ $t('admin.sessions.currentHint') }}</span>
          <UiButton
            v-else
            variant="secondary"
            size="sm"
            :disabled="busy"
            :aria-label="$t('admin.sessions.revokeLabel', { device: device(session) })"
            @click="revoke(session.id)"
          >
            {{ $t('admin.sessions.revoke') }}
          </UiButton>
        </li>
      </ul>
    </template>

    <UiStatusMessage
      v-if="status"
      :tone="status.tone"
    >
      {{ status.text }}
    </UiStatusMessage>
  </div>
</template>
