<script setup lang="ts">
// Stands for every admin URL until the admin routes are registered (F11-T6): the global admin-routes middleware
// registers them and navigates again to the same URL, which then matches the real screen. Renders nothing
definePageMeta({ i18n: false, layout: false })
</script>

<template>
  <div />
</template>
