<script setup lang="ts">
// Admin shell (F03-T5): skip link, navigation, who is signed in and sign-out. Loaded only on admin pages
import { can } from '#shared/auth/permissions'
import { authClient } from '~/utils/admin/auth-client'
import { useAdminUser } from '~/utils/admin/session'

const user = useAdminUser()
// Hides the link only; /api/admin/audit checks audit:read itself
const canReadAudit = computed(() => can(user.value?.role ?? '', { audit: ['read'] }))
const canReadSettings = computed(() => can(user.value?.role ?? '', { settings: ['read'] }))
const canReadContact = computed(() => can(user.value?.role ?? '', { contact: ['read'] }))

const links = computed(() => [
  { to: '/admin', label: 'admin.layout.dashboard' },
  { to: '/admin/artigos', label: 'admin.layout.articles' },
  { to: '/admin/temas', label: 'admin.layout.tags' },
  { to: '/admin/projetos', label: 'admin.layout.projects' },
  { to: '/admin/paginas', label: 'admin.layout.pages' },
  { to: '/admin/tecnologias', label: 'admin.layout.technologies' },
  { to: '/admin/midia', label: 'admin.layout.media' },
  ...(canReadContact.value ? [{ to: '/admin/mensagens', label: 'admin.layout.contact' }] : []),
  ...(canReadSettings.value ? [{ to: '/admin/configuracoes', label: 'admin.layout.settings' }] : []),
  ...(canReadAudit.value ? [{ to: '/admin/auditoria', label: 'admin.layout.audit' }] : []),
  { to: '/admin/conta/passkeys', label: 'admin.layout.passkeys' },
  { to: '/admin/conta/sessoes', label: 'admin.layout.sessions' },
])

async function signOut() {
  await authClient.signOut()
  user.value = null
  await navigateTo('/admin/login')
}
</script>

<template>
  <div class="min-h-screen">
    <UiSkipLink>{{ $t('admin.layout.skip') }}</UiSkipLink>
    <header class="border-b border-border">
      <UiContainer class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
        <nav :aria-label="$t('admin.layout.nav')">
          <ul class="flex flex-wrap gap-x-4">
            <li
              v-for="link in links"
              :key="link.to"
            >
              <NuxtLink
                :to="link.to"
                class="inline-flex min-h-(--target-min) items-center font-strong text-text underline-offset-(--underline-offset) hover:text-accent hover:underline"
                exact-active-class="text-accent underline"
              >
                {{ $t(link.label) }}
              </NuxtLink>
            </li>
          </ul>
        </nav>
        <div class="flex flex-wrap items-center gap-4">
          <span
            v-if="user"
            class="text-step--1 text-text-muted"
          >{{ $t('admin.layout.signedInAs', { name: user.name }) }}</span>
          <UiButton
            variant="ghost"
            size="sm"
            @click="signOut"
          >
            {{ $t('admin.common.signOut') }}
          </UiButton>
        </div>
      </UiContainer>
    </header>
    <UiContainer
      id="main"
      as="main"
      tabindex="-1"
      class="py-section"
    >
      <slot />
    </UiContainer>
  </div>
</template>
