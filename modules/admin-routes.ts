// Admin routes out of the public JS (F11-T6, ADR-0016): Nuxt puts every page's route record (path, meta, preload
// list) in the entry every public page loads, and the admin's 14+ screens cost ~0.75 kB gz there. The admin is an SPA
// (ssr: false), so its routes can be registered in the browser on the first visit: this module takes the pages under
// /admin out of the public table, leaves one bridge route in their place, and writes the real routes to
// #build/admin-routes.mjs, which app/middleware/admin-routes.global.ts imports on demand. The pages stay in
// app/pages/admin and keep their definePageMeta (read through `?macro=true`, as Nuxt does)
import { addTemplate, addTypeTemplate, createResolver, defineNuxtModule } from 'nuxt/kit'
import type { NuxtPage } from 'nuxt/schema'

const isAdmin = (page: NuxtPage) => page.path === '/admin' || page.path.startsWith('/admin/')

export default defineNuxtModule({
  meta: { name: 'admin-routes' },
  setup(_options, nuxt) {
    const { resolve } = createResolver(import.meta.url)
    let adminPages: NuxtPage[] = []

    // After Nuxt has extracted each page's static meta (middleware among it) and after @nuxtjs/i18n has localized
    // the routes: hooks added once every module is set up run last, so the bridge is not localized
    nuxt.hook('modules:done', () => {
      nuxt.hook('pages:resolved', (pages) => {
        adminPages = pages.filter(isAdmin)
        if (adminPages.some(page => page.children?.length)) {
          throw new Error('admin-routes: nested admin routes are not supported')
        }
        pages.splice(0, pages.length, ...pages.filter(page => !isAdmin(page)), {
          name: 'admin-bridge',
          path: '/admin/:rest(.*)*',
          file: resolve('../app/admin/RouteBridge.vue'),
        })
      })
    })

    addTemplate({
      filename: 'admin-routes.mjs',
      getContents: () => {
        const imports = adminPages.map((page, index) => `import { default as meta${index} } from ${JSON.stringify(`${page.file}?macro=true`)}`)
        const routes = adminPages.map((page, index) => `  {
    name: meta${index}?.name ?? ${JSON.stringify(page.name)},
    path: meta${index}?.path ?? ${JSON.stringify(page.path)},
    meta: { ...(meta${index} || {}), ...${JSON.stringify(page.meta ?? {})} },
    component: () => import(${JSON.stringify(page.file)}),
  }`)
        return `${imports.join('\n')}\n\nexport const adminRoutes = [\n${routes.join(',\n')}\n]\n`
      },
    })
    addTypeTemplate({
      filename: 'types/admin-routes.d.ts',
      getContents: () => `declare module '#build/admin-routes.mjs' {\n  export const adminRoutes: import('vue-router').RouteRecordRaw[]\n}\nexport {}\n`,
    })
  },
})
