<script setup lang="ts">
// Everything of a project page that is static (F07-T2, RF-09.1): the case-study header with the project's details
// (role, period, technologies, GitHub and demo links), the verifiable results, the narrative, the gallery and related
// projects. The page loads it with hydrate-never, so none of this code is downloaded on a first visit; the page runs
// the content enhancements (gallery dialog, video facades, copy) on its own root
import { IMAGE_SIZES } from '#shared/design/tokens'
import type { PublicProject } from '#shared/content/projects-public'
import StaticContent from '~/components/content/StaticContent.vue'
import ResponsiveImage from '~/components/media/ResponsiveImage.vue'
import ProjectCard from './ProjectCard.vue'

const props = defineProps<{ project: PublicProject }>()
const formatPeriod = useFormatPeriod()
const ids = { details: useId(), results: useId(), narrative: useId(), gallery: useId(), related: useId() }
// The slug in this locale, for the view-transition name it shares with the project's cards
const slug = computed(() => props.project.alternates.find(item => item.locale === props.project.locale)?.slug ?? 'project')
const period = computed(() => formatPeriod(props.project.periodStart, props.project.periodEnd))
const links = computed(() => [
  ...(props.project.repoUrl ? [{ href: props.project.repoUrl, label: 'projects.repo' }] : []),
  ...(props.project.demoUrl ? [{ href: props.project.demoUrl, label: 'projects.demo' }] : []),
])
</script>

<template>
  <article
    class="grid gap-12"
    :lang="project.locale"
  >
    <header class="grid gap-8 lg:grid-cols-12">
      <div class="grid content-start gap-4 lg:col-span-8">
        <UiHeading :level="1">
          {{ project.title }}
        </UiHeading>
        <p
          v-if="project.summary"
          class="text-step-1 text-text-muted"
        >
          {{ project.summary }}
        </p>
      </div>
      <section
        class="grid content-start gap-4 border-t border-border pt-4 lg:col-span-4 lg:border-t-0 lg:border-s lg:ps-6 lg:pt-0"
        :aria-labelledby="ids.details"
      >
        <UiHeading
          :id="ids.details"
          :level="2"
          :size="0"
          font="sans"
        >
          {{ $t('projects.details') }}
        </UiHeading>
        <dl class="grid gap-4 text-step--1">
          <div
            v-if="project.role"
            class="grid gap-1"
          >
            <dt class="font-mono text-text-muted uppercase">
              {{ $t('projects.role') }}
            </dt>
            <dd>{{ project.role }}</dd>
          </div>
          <div
            v-if="period"
            class="grid gap-1"
          >
            <dt class="font-mono text-text-muted uppercase">
              {{ $t('projects.period') }}
            </dt>
            <dd>{{ period }}</dd>
          </div>
          <div
            v-if="project.technologies.length > 0"
            class="grid gap-1"
          >
            <dt class="font-mono text-text-muted uppercase">
              {{ $t('projects.technologies') }}
            </dt>
            <dd>
              <ul class="flex flex-wrap gap-x-3">
                <li
                  v-for="technology in project.technologies"
                  :key="technology.slug"
                >
                  <NuxtLinkLocale
                    :to="{ name: 'projetos', query: { tech: technology.slug } }"
                    class="inline-flex min-h-(--target-min) items-center underline underline-offset-(--underline-offset) hover:text-accent"
                  >
                    {{ technology.name }}
                  </NuxtLinkLocale>
                </li>
              </ul>
            </dd>
          </div>
          <div
            v-if="links.length > 0"
            class="grid gap-1"
          >
            <dt class="font-mono text-text-muted uppercase">
              {{ $t('projects.links') }}
            </dt>
            <dd>
              <ul class="grid gap-1">
                <li
                  v-for="item in links"
                  :key="item.href"
                >
                  <a
                    :href="item.href"
                    rel="noopener noreferrer"
                    class="inline-flex min-h-(--target-min) items-center gap-1 underline underline-offset-(--underline-offset) hover:text-accent"
                  >
                    {{ $t(item.label) }}<span class="sr-only"> {{ $t('projects.external') }}</span><span aria-hidden="true">↗</span>
                  </a>
                </li>
              </ul>
            </dd>
          </div>
        </dl>
      </section>
    </header>

    <!-- The same view-transition name as the project's card cover: the card becomes this image (F10-T4) -->
    <ResponsiveImage
      v-if="project.cover"
      :image="project.cover"
      :sizes="IMAGE_SIZES.wide"
      priority
      class="vt-project"
      :style="{ viewTransitionName: `project-${slug}` }"
    />

    <section
      v-if="project.highlights.length > 0"
      class="grid gap-6"
      :aria-labelledby="ids.results"
    >
      <UiHeading
        :id="ids.results"
        :level="2"
        :size="3"
      >
        {{ $t('projects.results') }}
      </UiHeading>
      <dl class="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="(item, index) in project.highlights"
          :key="index"
          class="grid content-start gap-2 border-t border-border py-6"
        >
          <dt class="font-mono text-step--1 text-text-muted uppercase">
            {{ item.label }}
          </dt>
          <dd
            class="font-display text-step-4 wrap-anywhere"
            data-motion="highlight-value"
          >
            {{ item.value }}
          </dd>
          <dd
            v-if="item.note"
            class="text-step--1 text-text-muted"
          >
            {{ item.note }}
          </dd>
        </div>
      </dl>
    </section>

    <section
      class="grid max-w-(--container-reading) gap-6"
      :aria-labelledby="ids.narrative"
    >
      <UiHeading
        :id="ids.narrative"
        :level="2"
        :size="3"
        class="sr-only"
      >
        {{ $t('projects.narrative') }}
      </UiHeading>
      <StaticContent
        :document="project.body"
        :media="project.media"
        :enhance="false"
      />
    </section>

    <section
      v-if="project.gallery"
      class="grid max-w-(--container-reading) gap-6"
      :aria-labelledby="ids.gallery"
      data-motion="gallery"
    >
      <UiHeading
        :id="ids.gallery"
        :level="2"
        :size="3"
      >
        {{ $t('projects.gallery') }}
      </UiHeading>
      <StaticContent
        :document="project.gallery"
        :media="project.media"
        :enhance="false"
      />
    </section>

    <section
      v-if="project.related.length > 0"
      class="grid gap-6"
      :aria-labelledby="ids.related"
    >
      <UiHeading
        :id="ids.related"
        :level="2"
        :size="3"
      >
        {{ $t('projects.related') }}
      </UiHeading>
      <div class="grid gap-8 lg:grid-cols-3">
        <ProjectCard
          v-for="card in project.related"
          :key="card.slug"
          :card="card"
          :level="3"
        />
      </div>
    </section>
  </article>
</template>
