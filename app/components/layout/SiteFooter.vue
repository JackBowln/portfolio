<script setup lang="ts">
// Footer: every section again (the way through the site without JS, since the mobile menu needs a modern browser
// or hydration), the privacy page, the language switcher, and from the settings (F08-T1) the footer text, the social
// links and the public e-mail when the owner chose to show them, and the name in the copyright line
const language = useLocaleLanguage()
const settings = useSiteSettings()
const year = computed(() => new Intl.DateTimeFormat(language.value, { year: 'numeric', timeZone: 'UTC' }).format(new Date()))
const social = computed(() => (settings.value.footer.showSocial ? settings.value.social : []))
</script>

<template>
  <footer class="border-t border-border">
    <UiContainer class="grid gap-6 py-8 text-step--1 md:grid-cols-[1fr_auto] md:items-start">
      <LayoutSiteNav
        :label="$t('layout.footer.nav')"
        with-privacy
      />
      <LayoutLanguageSwitcher />
      <p
        v-if="settings.footer.text"
        class="md:col-span-2"
        data-testid="footer-text"
      >
        {{ settings.footer.text }}
      </p>
      <ul
        v-if="social.length > 0 || settings.contactEmail"
        class="flex flex-wrap gap-x-4 gap-y-2 md:col-span-2"
        :aria-label="$t('layout.footer.social')"
      >
        <li
          v-for="link in social"
          :key="link.url"
        >
          <a
            :href="link.url"
            rel="me noopener noreferrer"
            class="inline-flex min-h-(--target-min) items-center underline underline-offset-(--underline-offset) hover:text-accent"
          >{{ $t(`layout.social.${link.network}`) }}</a>
        </li>
        <li v-if="settings.contactEmail">
          <a
            :href="`mailto:${settings.contactEmail}`"
            class="inline-flex min-h-(--target-min) items-center underline underline-offset-(--underline-offset) hover:text-accent"
          >{{ settings.contactEmail }}</a>
        </li>
      </ul>
      <p class="text-text-muted md:col-span-2">
        {{ $t('layout.footer.copyright', { year, name: settings.identity.name }) }}
      </p>
    </UiContainer>
  </footer>
</template>
