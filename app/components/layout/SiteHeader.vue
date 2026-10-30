<script setup lang="ts">
// Static header (not fixed, so it never covers the focused element): site name, sections and theme. Below md the
// sections move into the mobile menu; the language switcher lives in the footer, once per page. The name comes from
// the settings (F08-T1)
const settings = useSiteSettings()
</script>

<template>
  <header class="border-b border-border">
    <UiContainer class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4">
      <UiLocalizedLink
        to="/"
        class="inline-flex min-h-(--target-comfortable) items-center font-display text-step-1 no-underline hover:text-accent"
      >
        {{ settings.identity.name }}
      </UiLocalizedLink>
      <div class="flex items-center gap-6">
        <LayoutSiteNav
          class="hidden md:block"
          :label="$t('layout.nav.label')"
        />
        <LayoutThemeToggle />
        <LayoutMobileMenu class="md:hidden" />
      </div>
    </UiContainer>
  </header>
</template>
