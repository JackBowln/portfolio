<script setup lang="ts">
// Test-only fixture: exists only in the Playwright build (`ignore: **/_test/**`). Fails during SSR so the localized
// 500 page and its status can be checked in every locale; `?unhandled` throws a plain Error, whose message must
// not reach the page
const route = useRoute()
if (route.query.unhandled !== undefined) {
  throw new Error('TEST internal detail')
}
throw createError({ statusCode: 500, statusMessage: 'Test server error' })
</script>

<template>
  <div />
</template>
