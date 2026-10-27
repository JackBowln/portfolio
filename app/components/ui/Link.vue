<script setup lang="ts">
// Plain link for any href (localized site links use UiLocalizedLink). The target is checked by protocol first
// (shared/utils/url.ts): anything but http(s), mailto, tel or a path on this site renders as text, never as a link.
// External links open in the same tab, so no "opens in a new tab" warning is needed
import { isExternalHref, safeHref } from '#shared/utils/url'

const props = withDefaults(defineProps<{
  href: string
  variant?: 'inline' | 'standalone'
}>(), { variant: 'inline' })

const { public: { siteUrl } } = useRuntimeConfig()
const target = computed(() => safeHref(props.href))
const external = computed(() => target.value !== undefined && isExternalHref(target.value, siteUrl))

const VARIANTS = {
  inline: 'text-accent underline hover:bg-accent hover:text-accent-contrast hover:no-underline active:bg-accent-active active:text-accent-contrast',
  standalone: 'inline-flex min-h-(--target-min) items-center gap-2 font-strong text-text underline-offset-(--underline-offset) hover:text-accent hover:underline active:text-accent-active',
} as const
</script>

<template>
  <a
    v-if="target"
    :href="target"
    :rel="external ? 'noopener noreferrer' : undefined"
    class="transition-colors duration-(--dur-instant) ease-out"
    :class="VARIANTS[variant]"
  >
    <slot />
    <UiIcon
      v-if="variant === 'standalone'"
      :name="external ? 'arrow-up-right' : 'arrow-right'"
    />
  </a>
  <span v-else><slot /></span>
</template>
