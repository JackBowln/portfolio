<script setup lang="ts">
// Section links shared by the header, the mobile menu and the footer, in the order and selection of the navigation
// settings (F08-T1). `to` is the pt-BR path (UiLocalizedLink); NuxtLink marks the current page with aria-current,
// which the styles reuse
const props = withDefaults(defineProps<{
  label: string
  layout?: 'row' | 'column'
  withPrivacy?: boolean
}>(), { layout: 'row', withPrivacy: false })

const LINKS = {
  projects: { to: '/projetos', label: 'layout.nav.projects' },
  blog: { to: '/blog', label: 'layout.nav.blog' },
  about: { to: '/sobre', label: 'layout.nav.about' },
  contact: { to: '/contato', label: 'layout.nav.contact' },
} as const

const settings = useSiteSettings()
const links = computed(() => {
  const pages = settings.value.navigation.map(page => LINKS[page])
  return props.withPrivacy ? [...pages, { to: '/privacidade', label: 'layout.footer.privacy' }] : pages
})

const LAYOUTS = {
  row: { list: 'flex flex-wrap gap-x-6 gap-y-2', link: 'min-h-(--target-min)' },
  column: { list: 'grid gap-2', link: 'min-h-(--target-comfortable) font-display text-step-3' },
} as const
</script>

<template>
  <nav :aria-label="label">
    <ul :class="LAYOUTS[layout].list">
      <li
        v-for="link in links"
        :key="link.to"
      >
        <UiLocalizedLink
          :to="link.to"
          class="inline-flex items-center underline-offset-(--underline-offset) transition-colors duration-(--dur-instant) ease-out hover:text-accent hover:underline aria-[current=page]:text-accent aria-[current=page]:underline"
          :class="LAYOUTS[layout].link"
        >
          {{ $t(link.label) }}
        </UiLocalizedLink>
      </li>
    </ul>
  </nav>
</template>
