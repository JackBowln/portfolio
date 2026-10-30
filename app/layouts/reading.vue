<script setup lang="ts">
// Long-form reading (blog article, preview): the same frame with <main> at the reading measure, no motion, and the
// stylesheet of document blocks (code, callouts, galleries, embeds), which never-hydrated content cannot bring itself
import '~/assets/css/content.css'
</script>

<template>
  <LayoutSiteShell size="reading">
    <slot />
  </LayoutSiteShell>
</template>
