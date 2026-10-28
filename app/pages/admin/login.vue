<script setup lang="ts">
// Admin sign-in (ADR-0005 §2): passkey first, GitHub (allowlisted owner only) for recovery.
// The admin SPA shell, layout and route guard arrive in F03-T5
import { authClient } from '~/utils/admin/auth-client'

definePageMeta({ i18n: false })

const { t } = useI18n()
const route = useRoute()
const error = ref(route.query.error ? t('admin.login.githubFailed') : '')
const busy = ref(false)

const AFTER_LOGIN = '/admin/conta/passkeys'

async function signInWithPasskey() {
  busy.value = true
  error.value = ''
  const result = await authClient.signIn.passkey()
  busy.value = false
  if (result?.error) {
    error.value = t('admin.login.passkeyFailed')
    return
  }
  await navigateTo(AFTER_LOGIN)
}

async function signInWithGithub() {
  busy.value = true
  await authClient.signIn.social({ provider: 'github', callbackURL: AFTER_LOGIN, errorCallbackURL: '/admin/login?error=github' })
}

useHead({ title: () => t('admin.login.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <UiContainer
    as="main"
    size="reading"
    class="grid gap-6 py-section"
  >
    <UiHeading :level="1">
      {{ $t('admin.login.title') }}
    </UiHeading>
    <p>{{ $t('admin.login.intro') }}</p>
    <div class="flex flex-wrap gap-4">
      <UiButton
        :disabled="busy"
        @click="signInWithPasskey"
      >
        {{ $t('admin.login.passkey') }}
      </UiButton>
      <UiButton
        variant="secondary"
        :disabled="busy"
        @click="signInWithGithub"
      >
        {{ $t('admin.login.github') }}
      </UiButton>
    </div>
    <UiStatusMessage
      v-if="error"
      tone="danger"
    >
      {{ error }}
    </UiStatusMessage>
  </UiContainer>
</template>
