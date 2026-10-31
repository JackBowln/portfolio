<script setup lang="ts">
// Dashboard (RF-02.3). Translations (F09-T1): pending work per locale and entity type, from the server (which checks
// translation:review); the other cards wait for their data (drafts and schedule counts, the AI budget in F09-T3)
// and say so instead of showing a made-up number
import { can } from '#shared/auth/permissions'
import type { Locale } from '#shared/types/enums'
import { adminFetch, useAdminUser } from '~/utils/admin/session'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

type Pending = 'missing' | 'machine' | 'in_review' | 'outdated'
interface Summary {
  locales: Locale[]
  rows: { entity: string, locales: Record<Locale, Record<Pending, number>> }[]
}

const PENDING: Pending[] = ['missing', 'machine', 'in_review', 'outdated']
const CARDS = ['drafts', 'scheduled', 'aiUsage'] as const

const { t } = useI18n()
const user = useAdminUser()
const canReview = computed(() => can(user.value?.role ?? '', { translation: ['review'] }))
const summary = ref<Summary | null>(null)
const failed = ref(false)

onMounted(async () => {
  if (!canReview.value) {
    return
  }
  try {
    summary.value = await adminFetch<Summary>('/api/admin/translations/summary')
  }
  catch {
    failed.value = true
  }
})

const total = (counts: Record<Pending, number>) => PENDING.reduce((sum, state) => sum + counts[state], 0)
const rows = computed(() => summary.value?.rows.filter(row => summary.value!.locales.some(locale => total(row.locales[locale]) > 0)) ?? [])
const localeTotal = (locale: Locale) => rows.value.reduce((sum, row) => sum + total(row.locales[locale]), 0)

useHead({ title: () => t('admin.dashboard.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid gap-8">
    <div class="grid gap-3">
      <UiHeading :level="1">
        {{ $t('admin.dashboard.title') }}
      </UiHeading>
      <p>{{ $t('admin.dashboard.intro') }}</p>
    </div>

    <section
      v-if="canReview"
      class="grid gap-4"
      aria-labelledby="dashboard-translations"
      data-testid="dashboard-translations"
    >
      <UiHeading
        id="dashboard-translations"
        :level="2"
        :size="3"
      >
        {{ $t('admin.dashboard.translationsTitle') }}
      </UiHeading>
      <p class="text-text-muted">
        {{ $t('admin.dashboard.translationsIntro') }}
      </p>
      <UiStatusMessage
        v-if="failed"
        tone="danger"
      >
        {{ $t('admin.common.unexpectedError') }}
      </UiStatusMessage>
      <template v-else-if="summary">
        <p v-if="rows.length === 0">
          {{ $t('admin.dashboard.translationsEmpty') }}
        </p>
        <div
          v-else
          class="overflow-x-auto"
        >
          <table class="w-full text-start text-step--1">
            <caption class="sr-only">
              {{ $t('admin.dashboard.translationsTitle') }}
            </caption>
            <thead>
              <tr class="border-b border-border">
                <th
                  scope="col"
                  class="py-2 pe-4 text-start"
                >
                  {{ $t('admin.dashboard.entity') }}
                </th>
                <th
                  v-for="locale in summary.locales"
                  :key="locale"
                  scope="col"
                  class="py-2 pe-4 text-start"
                >
                  {{ locale }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in rows"
                :key="row.entity"
                class="border-b border-border align-top"
                :data-entity="row.entity"
              >
                <th
                  scope="row"
                  class="py-2 pe-4 text-start font-strong"
                >
                  {{ $t(`admin.dashboard.entities.${row.entity}`) }}
                </th>
                <td
                  v-for="locale in summary.locales"
                  :key="locale"
                  class="py-2 pe-4"
                  :data-locale="locale"
                >
                  <ul
                    v-if="total(row.locales[locale]) > 0"
                    class="grid gap-1"
                  >
                    <template
                      v-for="state in PENDING"
                      :key="state"
                    >
                      <li v-if="row.locales[locale][state] > 0">
                        {{ $t(`admin.articles.translationStates.${state}`) }}: {{ row.locales[locale][state] }}
                      </li>
                    </template>
                  </ul>
                  <span v-else>0</span>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th
                  scope="row"
                  class="py-2 pe-4 text-start"
                >
                  {{ $t('admin.dashboard.total') }}
                </th>
                <td
                  v-for="locale in summary.locales"
                  :key="locale"
                  class="py-2 pe-4 font-strong"
                  :data-total="locale"
                >
                  {{ localeTotal(locale) }}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </template>
    </section>

    <ul class="grid gap-4 sm:grid-cols-3">
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
