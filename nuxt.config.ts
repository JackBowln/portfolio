// https://nuxt.com/docs/api/configuration/nuxt-config
import { version } from './package.json'

export default defineNuxtConfig({
  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
    },
  },

  runtimeConfig: {
    // Private (server-only); returned by GET /api/health
    appVersion: version,
  },

  compatibilityDate: '2026-10-25',

  routeRules: {
    '/api/health': { headers: { 'cache-control': 'no-store' } },
  },

  typescript: {
    strict: true,
    tsConfig: {
      compilerOptions: {
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
      },
    },
  },
})
