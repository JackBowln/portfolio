<script setup lang="ts">
// One contact message (F08-T3): opening it marks it read; archive, spam, back to read, or delete for good (decision
// 4). The server checks contact:update and contact:delete; the buttons only follow the role
import { can } from '#shared/auth/permissions'
import type { ContactStatus } from '#shared/types/enums'
import type { ContactMessage } from '~/utils/admin/contact'
import { formatDateTime } from '~/utils/admin/format'
import { adminFetch, useAdminUser } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const route = useRoute()
const user = useAdminUser()
const id = computed(() => String(route.params.id))
const item = ref<ContactMessage | null>(null)
const missing = ref(false)
const error = ref('')
const notice = ref('')
const busy = ref(false)

const canUpdate = computed(() => can(user.value?.role ?? '', { contact: ['update'] }))
const canDelete = computed(() => can(user.value?.role ?? '', { contact: ['delete'] }))
const paragraphs = computed(() => item.value?.message.split(/\n+/).filter(Boolean) ?? [])
const MOVES: { status: Exclude<ContactStatus, 'new'>, label: string }[] = [
  { status: 'archived', label: 'admin.contact.actions.archive' },
  { status: 'spam', label: 'admin.contact.actions.spam' },
  { status: 'read', label: 'admin.contact.actions.read' },
]

onMounted(async () => {
  try {
    item.value = await adminFetch<ContactMessage>(`/api/admin/contact/${encodeURIComponent(id.value)}`)
  }
  catch (failure) {
    if ((failure as { statusCode?: number }).statusCode === 404) {
      missing.value = true
    }
    else {
      error.value = t('admin.common.unexpectedError')
    }
  }
})

async function move(status: Exclude<ContactStatus, 'new'>) {
  busy.value = true
  error.value = ''
  try {
    item.value = await adminFetch<ContactMessage>(`/api/admin/contact/${encodeURIComponent(id.value)}`, { method: 'PATCH', body: { status } })
    notice.value = t('admin.contact.updated', { status: t(`admin.contact.statuses.${status}`) })
  }
  catch {
    error.value = t('admin.common.unexpectedError')
  }
  finally {
    busy.value = false
  }
}

async function remove() {
  if (!window.confirm(t('admin.contact.confirmDelete'))) {
    return
  }
  busy.value = true
  error.value = ''
  try {
    await adminFetch(`/api/admin/contact/${encodeURIComponent(id.value)}`, { method: 'DELETE' })
    await navigateTo('/admin/mensagens')
  }
  catch {
    error.value = t('admin.common.unexpectedError')
    busy.value = false
  }
}

useHead({ title: () => item.value?.name ?? t('admin.contact.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid max-w-(--container-reading) gap-6">
    <NuxtLink
      to="/admin/mensagens"
      class="justify-self-start underline underline-offset-(--underline-offset) hover:text-accent"
    >
      {{ $t('admin.contact.actions.back') }}
    </NuxtLink>
    <UiStatusMessage
      v-if="missing"
      tone="warning"
    >
      {{ $t('admin.contact.notFound') }}
    </UiStatusMessage>
    <UiStatusMessage
      v-if="error"
      tone="danger"
    >
      {{ error }}
    </UiStatusMessage>
    <UiStatusMessage
      v-if="notice"
      tone="success"
    >
      {{ notice }}
    </UiStatusMessage>

    <article
      v-if="item"
      class="grid gap-6"
      data-testid="contact-message"
    >
      <header class="grid gap-2">
        <UiHeading :level="1">
          {{ item.name }}
        </UiHeading>
        <p class="text-text-muted">
          {{ $t(`admin.contact.statuses.${item.status}`) }} · {{ $t('admin.contact.received', { date: formatDateTime(item.createdAt) }) }} · {{ item.locale }}
        </p>
        <p>
          {{ $t('admin.contact.from') }}:
          <a
            :href="`mailto:${item.email}`"
            class="underline underline-offset-(--underline-offset) hover:text-accent"
          >{{ item.email }}</a>
        </p>
      </header>
      <div class="grid gap-4 whitespace-pre-line">
        <p
          v-for="(text, index) in paragraphs"
          :key="index"
        >
          {{ text }}
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <template v-if="canUpdate">
          <UiButton
            v-for="action in MOVES.filter(action => action.status !== item?.status)"
            :key="action.status"
            variant="secondary"
            size="sm"
            :disabled="busy"
            @click="move(action.status)"
          >
            {{ $t(action.label) }}
          </UiButton>
        </template>
        <UiButton
          v-if="canDelete"
          variant="ghost"
          size="sm"
          :disabled="busy"
          @click="remove"
        >
          {{ $t('admin.contact.actions.delete') }}
        </UiButton>
      </div>
    </article>
  </div>
</template>
