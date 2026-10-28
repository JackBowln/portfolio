<script setup lang="ts">
// Owner bootstrap (ADR-0005 §3): token → GitHub (allowlisted owner) → register a passkey.
// The server decides: /api/setup answers 404 once an owner exists, and GitHub creates a user only with the grant
import { authClient } from '~/utils/admin/auth-client'

definePageMeta({ i18n: false })

const { t } = useI18n()
const route = useRoute()

type Step = 'checking' | 'closed' | 'token' | 'passkey'
const step = ref<Step>('checking')
const token = ref('')
const tokenError = ref<string>()
const error = ref('')
const busy = ref(false)
const hasSession = ref(false)

onMounted(async () => {
  if (route.query.step === 'passkey') {
    const { data } = await authClient.getSession()
    hasSession.value = !!data
    step.value = 'passkey'
    return
  }
  try {
    await $fetch('/api/setup')
    step.value = 'token'
  }
  catch {
    step.value = 'closed'
  }
})

async function submitToken() {
  busy.value = true
  tokenError.value = undefined
  try {
    await $fetch('/api/setup', { method: 'POST', body: { token: token.value } })
  }
  catch {
    busy.value = false
    tokenError.value = t('admin.setup.invalidToken')
    return
  }
  await authClient.signIn.social({ provider: 'github', callbackURL: '/admin/setup?step=passkey', errorCallbackURL: '/admin/login?error=github' })
}

async function registerPasskey() {
  busy.value = true
  error.value = ''
  const result = await authClient.passkey.addPasskey()
  busy.value = false
  if (result?.error) {
    error.value = t('admin.common.unexpectedError')
    return
  }
  await navigateTo('/admin/conta/passkeys')
}

useHead({ title: () => t('admin.setup.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <UiContainer
    as="main"
    size="reading"
    class="grid gap-6 py-section"
  >
    <UiHeading :level="1">
      {{ $t('admin.setup.title') }}
    </UiHeading>

    <p v-if="step === 'closed'">
      {{ $t('admin.setup.closed') }}
    </p>

    <form
      v-else-if="step === 'token'"
      class="grid gap-6"
      novalidate
      @submit.prevent="submitToken"
    >
      <p>{{ $t('admin.setup.intro') }}</p>
      <UiField
        v-slot="field"
        :label="$t('admin.setup.tokenLabel')"
        :description="$t('admin.setup.tokenDescription')"
        :error="tokenError"
        required
      >
        <UiInput
          v-model="token"
          v-bind="field"
          type="password"
          name="token"
          autocomplete="off"
        />
      </UiField>
      <div>
        <UiButton
          type="submit"
          :disabled="busy"
        >
          {{ $t('admin.setup.continue') }}
        </UiButton>
      </div>
    </form>

    <section
      v-else-if="step === 'passkey'"
      class="grid gap-6"
      aria-labelledby="setup-passkey"
    >
      <UiHeading
        id="setup-passkey"
        :level="2"
      >
        {{ $t('admin.setup.passkeyTitle') }}
      </UiHeading>
      <template v-if="hasSession">
        <p>{{ $t('admin.setup.passkeyIntro') }}</p>
        <div>
          <UiButton
            :disabled="busy"
            @click="registerPasskey"
          >
            {{ $t('admin.setup.registerPasskey') }}
          </UiButton>
        </div>
      </template>
      <p v-else>
        {{ $t('admin.setup.needsSession') }}
      </p>
      <UiStatusMessage
        v-if="error"
        tone="danger"
      >
        {{ error }}
      </UiStatusMessage>
    </section>
  </UiContainer>
</template>
