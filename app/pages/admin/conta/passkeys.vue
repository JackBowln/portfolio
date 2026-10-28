<script setup lang="ts">
// Passkey management (ADR-0005 §2, §4): list, add, remove. The server enforces the rules (fresh session to remove,
// never the last passkey without GitHub); this page only explains its answers
import { AUTH_ERRORS, authClient } from '~/utils/admin/auth-client'

definePageMeta({ i18n: false })

interface PasskeyRow {
  id: string
  name?: string | null | undefined
  createdAt?: Date | string | null | undefined
}

const { t } = useI18n()
const formatDate = useFormatDate()
const passkeys = ref<PasskeyRow[]>([])
const loaded = ref(false)
const status = ref<{ tone: 'success' | 'danger', text: string, signInAgain?: boolean }>()
const busy = ref(false)

async function load() {
  const { data } = await authClient.passkey.listUserPasskeys()
  passkeys.value = data ?? []
  loaded.value = true
}

onMounted(async () => {
  const { data } = await authClient.getSession()
  if (!data) {
    await navigateTo('/admin/login')
    return
  }
  await load()
})

function explain(error: { code?: string } | object) {
  const code = 'code' in error ? error.code : undefined
  if (code === AUTH_ERRORS.sessionNotFresh || code === 'SESSION_IS_NOT_FRESH') {
    status.value = { tone: 'danger', text: t('admin.passkeys.notFresh'), signInAgain: true }
  }
  else if (code === AUTH_ERRORS.lastPasskey) {
    status.value = { tone: 'danger', text: t('admin.passkeys.lastPasskey') }
  }
  else {
    status.value = { tone: 'danger', text: t('admin.common.unexpectedError') }
  }
}

async function add() {
  busy.value = true
  const result = await authClient.passkey.addPasskey()
  busy.value = false
  if (result?.error) {
    explain(result.error)
    return
  }
  status.value = { tone: 'success', text: t('admin.passkeys.added') }
  await load()
}

async function remove(id: string) {
  busy.value = true
  const { error } = await authClient.passkey.deletePasskey({ id })
  busy.value = false
  if (error) {
    explain(error)
    return
  }
  status.value = { tone: 'success', text: t('admin.passkeys.removed') }
  await load()
}

async function signOut() {
  await authClient.signOut()
  await navigateTo('/admin/login')
}

const label = (passkey: PasskeyRow) => passkey.name || t('admin.passkeys.unnamed')

useHead({ title: () => t('admin.passkeys.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <UiContainer
    as="main"
    size="reading"
    class="grid gap-6 py-section"
  >
    <div class="flex flex-wrap items-center justify-between gap-4">
      <UiHeading :level="1">
        {{ $t('admin.passkeys.title') }}
      </UiHeading>
      <UiButton
        variant="ghost"
        @click="signOut"
      >
        {{ $t('admin.common.signOut') }}
      </UiButton>
    </div>
    <p>{{ $t('admin.passkeys.intro') }}</p>

    <template v-if="loaded">
      <p v-if="passkeys.length === 0">
        {{ $t('admin.passkeys.empty') }}
      </p>
      <ul
        v-else
        class="grid gap-3"
      >
        <li
          v-for="passkey in passkeys"
          :key="passkey.id"
          class="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3"
          data-testid="passkey-row"
        >
          <span class="grid">
            <span class="font-strong">{{ label(passkey) }}</span>
            <span
              v-if="passkey.createdAt"
              class="text-step--1 text-text-muted"
            >{{ $t('admin.passkeys.createdAt', { date: formatDate(new Date(passkey.createdAt)) }) }}</span>
          </span>
          <UiButton
            variant="secondary"
            size="sm"
            :disabled="busy"
            :aria-label="$t('admin.passkeys.removeLabel', { name: label(passkey) })"
            @click="remove(passkey.id)"
          >
            {{ $t('admin.passkeys.remove') }}
          </UiButton>
        </li>
      </ul>
    </template>

    <div>
      <UiButton
        :disabled="busy"
        @click="add"
      >
        {{ $t('admin.passkeys.add') }}
      </UiButton>
    </div>

    <UiStatusMessage
      v-if="status"
      :tone="status.tone"
    >
      <p>{{ status.text }}</p>
      <p v-if="status.signInAgain">
        <UiLink href="/admin/login">{{ $t('admin.passkeys.signInAgain') }}</UiLink>
      </p>
    </UiStatusMessage>
  </UiContainer>
</template>
