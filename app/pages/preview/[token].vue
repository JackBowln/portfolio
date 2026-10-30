<script setup lang="ts">
// A preview link (F06-T3, RF-05.3): the working copy in the article's real layout, under a visible "Preview" band
// that says until when the link works. Never cached nor indexed (routeRules, meta robots); any bad or stale link is
// a plain 404
import type { ArticlePreview } from '#shared/content/preview'
import { formatInZone } from '#shared/utils/time-zone'
import ArticleView from '~/components/content/ArticleView.vue'

definePageMeta({ i18n: false, layout: 'reading' })

const route = useRoute()
const { t } = useI18n()
const token = String(route.params.token)
// useState and one fetch instead of useAsyncData: the data layer would add ~5 kB to every public route's initial JS
// (perf-log, F06-T3). Fetched during SSR and sent in the payload; fetched in the browser only after a client-side
// navigation, which a shared link does not do
const data = useState<ArticlePreview | null>(`preview:${token}`, () => null)
if (!data.value) {
  data.value = await useRequestFetch()<ArticlePreview>(`/api/preview/${encodeURIComponent(token)}`).catch(() => null)
}
if (!data.value) {
  throw createError({ statusCode: 404, statusMessage: 'Not Found', fatal: true })
}

// In the site's time zone (Q-06), with its name
const expires = computed(() => (data.value ? formatInZone(data.value.expiresAt * 1000, 'pt-BR') : ''))

useHead({
  title: () => t('preview.title', { title: data.value?.title ?? '' }),
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

<template>
  <div
    v-if="data"
    class="grid gap-10"
  >
    <p
      role="note"
      class="border-s-4 border-warning bg-surface px-4 py-3"
      data-testid="preview-band"
    >
      <strong class="font-strong">{{ $t('preview.label') }}</strong>
      · {{ $t('preview.notice', { date: expires }) }}
    </p>
    <ArticleView
      :locale="data.locale"
      :title="data.title"
      :excerpt="data.excerpt"
      :body="data.body"
      :media="data.media"
      :cover="data.cover"
      :reading-time-min="data.readingTimeMin"
    />
  </div>
</template>
