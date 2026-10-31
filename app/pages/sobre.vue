<script setup lang="ts">
// About (F08-T2, RF-01.2): the published introduction (a document), background, skills and links. In a locale without
// its own published page it shows pt-BR with a notice (noindex there); with nothing published, an empty state
import '~/assets/css/content.css'
import type { PageBlocks } from '#shared/pages/blocks'
import type { PublicPage } from '#shared/pages/public'
import StaticContent from '~/components/content/StaticContent.vue'
import FallbackNotice from '~/components/pages/FallbackNotice.vue'
import PageEmpty from '~/components/pages/PageEmpty.vue'

definePageMeta({
  i18n: {
    paths: {
      'pt-BR': '/sobre',
      'en': '/about',
      'es': '/sobre-mi',
      'de': '/ueber-mich',
      'fr': '/a-propos',
    },
  },
})

const { locale, t } = useI18n()
const data = await usePublicData<PublicPage<PageBlocks<'about'>>>(`page:about:${locale.value}`, '/api/public/pages/about', { locale: locale.value })
useInstitutionalSeo(data, () => t('pages.about.title'))
const ids = { timeline: useId(), skills: useId(), links: useId() }
</script>

<template>
  <PageEmpty
    v-if="!data.blocks"
    :title="$t('pages.about.title')"
  />
  <div
    v-else
    class="grid gap-12"
  >
    <FallbackNotice v-if="data.fallback" />
    <article
      class="grid gap-12"
      :lang="data.fallback ? 'pt-BR' : undefined"
    >
      <UiHeading :level="1">
        {{ $t('pages.about.title') }}
      </UiHeading>
      <div
        v-if="data.blocks.intro"
        class="max-w-(--container-reading)"
      >
        <StaticContent
          :document="data.blocks.intro"
          :media="data.media"
        />
      </div>
      <section
        v-if="data.blocks.timeline.length > 0"
        class="grid gap-6"
        :aria-labelledby="ids.timeline"
      >
        <UiHeading
          :id="ids.timeline"
          :level="2"
          :size="3"
        >
          {{ $t('pages.about.timeline') }}
        </UiHeading>
        <ol class="grid gap-6">
          <li
            v-for="(item, index) in data.blocks.timeline"
            :key="index"
            class="grid gap-1 border-t border-border pt-4 md:grid-cols-[12rem_1fr] md:gap-x-8"
          >
            <p class="font-mono text-step--1 text-text-muted uppercase">
              {{ item.period }}
            </p>
            <div class="grid gap-1">
              <UiHeading
                :level="3"
                :size="1"
                font="sans"
              >
                {{ item.title }}
              </UiHeading>
              <p
                v-if="item.text"
                class="text-text-muted"
              >
                {{ item.text }}
              </p>
            </div>
          </li>
        </ol>
      </section>
      <section
        v-if="data.blocks.skills.length > 0"
        class="grid gap-6"
        :aria-labelledby="ids.skills"
      >
        <UiHeading
          :id="ids.skills"
          :level="2"
          :size="3"
        >
          {{ $t('pages.about.skills') }}
        </UiHeading>
        <dl class="grid gap-6 sm:grid-cols-2">
          <div
            v-for="(group, index) in data.blocks.skills"
            :key="index"
            class="grid content-start gap-2 border-t border-border pt-4"
          >
            <dt class="font-strong">
              {{ group.group }}
            </dt>
            <dd class="text-text-muted">
              {{ group.items.map(item => item.trim()).filter(Boolean).join(', ') }}
            </dd>
          </div>
        </dl>
      </section>
      <section
        v-if="data.blocks.links.length > 0"
        class="grid gap-4"
        :aria-labelledby="ids.links"
      >
        <UiHeading
          :id="ids.links"
          :level="2"
          :size="3"
        >
          {{ $t('pages.about.links') }}
        </UiHeading>
        <ul class="flex flex-wrap gap-x-6 gap-y-2">
          <li
            v-for="link in data.blocks.links"
            :key="link.url"
          >
            <a
              :href="link.url"
              rel="me noopener noreferrer"
              class="inline-flex min-h-(--target-min) items-center gap-1 underline underline-offset-(--underline-offset) hover:text-accent"
            >{{ link.label }}<span class="sr-only"> {{ $t('projects.external') }}</span><span aria-hidden="true">↗</span></a>
          </li>
        </ul>
      </section>
    </article>
  </div>
</template>
