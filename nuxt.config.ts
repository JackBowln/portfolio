// https://nuxt.com/docs/api/configuration/nuxt-config
import { version } from './package.json'

export default defineNuxtConfig({
  modules: ['@nuxt/eslint'],

  $production: {
    // Dev-only pages (the F01-T1 styleguide) never reach the production build
    ignore: ['**/pages/dev/**'],
  },

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

  routeRules: {
    '/api/health': { headers: { 'cache-control': 'no-store' } },
  },

  compatibilityDate: '2026-10-25',

  typescript: {
    strict: true,
    tsConfig: {
      compilerOptions: {
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
      },
    },
  },

  // ADR-0002 §6: ESLint flat config with stylistic formatting, no Prettier
  eslint: {
    config: {
      stylistic: true,
    },
  },
})
