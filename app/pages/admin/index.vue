<script setup lang="ts">
// Dashboard (RF-02.3). The counters need content, translations and the AI budget, which arrive from F06 on;
// until then each card says so instead of showing a made-up number
definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

const { t } = useI18n()

const CARDS = ['drafts', 'scheduled', 'translations', 'aiUsage'] as const

useHead({ title: () => t('admin.dashboard.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid gap-6">
    <UiHeading :level="1">
      {{ $t('admin.dashboard.title') }}
    </UiHeading>
    <p>{{ $t('admin.dashboard.intro') }}</p>
    <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <li
        v-for="card in CARDS"
        :key="card"
        class="grid gap-2 border border-border p-4"
        data-testid="dashboard-card"
      >
        <span class="font-strong">{{ $t(`admin.dashboard.${card}`) }}</span>
        <span
          class="text-step-2"
          aria-hidden="true"
        >—</span>
        <span class="text-step--1 text-text-muted">{{ $t('admin.dashboard.placeholder') }}</span>
      </li>
    </ul>
  </div>
</template>
