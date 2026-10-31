<script setup lang="ts">
// Contact inbox (F08-T3): newest first, filtered by state, one page at a time. The server checks contact:read; the
// list shows the start of each message only, the whole one opens on its own page (and is marked read there)
import { CONTACT_STATUSES } from '#shared/types/enums'
import type { ContactMessage, ContactInboxPage } from '~/utils/admin/contact'
import { formatDateTime } from '~/utils/admin/format'
import { adminFetch } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

const SELECT_CLASS = 'min-h-(--target-comfortable) w-full rounded-control border border-border bg-bg px-3 text-text hover:border-text'

const { t } = useI18n()
const status = ref('')
const items = ref<ContactMessage[]>([])
const unread = ref(0)
const nextCursor = ref<string | null>(null)
const loaded = ref(false)
const busy = ref(false)
const error = ref('')

async function fetchPage(cursor?: string) {
  busy.value = true
  error.value = ''
  try {
    const query = Object.fromEntries(Object.entries({ status: status.value, cursor }).filter(([, value]) => value))
    const page = await adminFetch<ContactInboxPage>('/api/admin/contact', { query })
    items.value = cursor ? [...items.value, ...page.items] : page.items
    unread.value = page.unread
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
watch(status, () => fetchPage())

const preview = (text: string) => (text.length > 140 ? `${text.slice(0, 140)}…` : text)

useHead({ title: () => t('admin.contact.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid gap-6">
    <div class="grid gap-3">
      <UiHeading :level="1">
        {{ $t('admin.contact.title') }}
      </UiHeading>
      <p>{{ $t('admin.contact.intro') }}</p>
      <p
        v-if="loaded"
        class="text-text-muted"
        data-testid="contact-unread"
      >
        {{ $t('admin.contact.unread', unread) }}
      </p>
    </div>

    <div class="max-w-xs">
      <UiField
        v-slot="field"
        :label="$t('admin.contact.filter')"
      >
        <select
          :id="field.id"
          v-model="status"
          :class="SELECT_CLASS"
        >
          <option value="">
            {{ $t('admin.contact.all') }}
          </option>
          <option
            v-for="item in CONTACT_STATUSES"
            :key="item"
            :value="item"
          >
            {{ $t(`admin.contact.statuses.${item}`) }}
          </option>
        </select>
      </UiField>
    </div>

    <UiStatusMessage
      v-if="error"
      tone="danger"
    >
      {{ error }}
    </UiStatusMessage>

    <template v-if="loaded">
      <p v-if="items.length === 0">
        {{ $t('admin.contact.empty') }}
      </p>
      <ul
        v-else
        class="grid gap-2"
      >
        <li
          v-for="item in items"
          :key="item.id"
          class="grid gap-1 border-b border-border py-3"
          data-testid="contact-row"
        >
          <NuxtLink
            :to="`/admin/mensagens/${item.id}`"
            class="justify-self-start underline underline-offset-(--underline-offset) hover:text-accent"
            :class="item.status === 'new' ? 'font-strong' : ''"
          >
            {{ item.name }}
          </NuxtLink>
          <p class="text-step--1 text-text-muted">
            {{ $t(`admin.contact.statuses.${item.status}`) }} · {{ $t('admin.contact.received', { date: formatDateTime(item.createdAt) }) }}
          </p>
          <p class="text-step--1">
            {{ preview(item.message) }}
          </p>
        </li>
      </ul>
      <div v-if="nextCursor">
        <UiButton
          variant="secondary"
          :disabled="busy"
          @click="fetchPage(nextCursor)"
        >
          {{ $t('admin.contact.more') }}
        </UiButton>
      </div>
    </template>
  </div>
</template>
