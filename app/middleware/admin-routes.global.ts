// The first navigation to /admin registers the admin routes (F11-T6, ADR-0016): they are left out of the public JS
// (modules/admin-routes.ts), imported here on demand, added to the router in place of the bridge route, and the same
// URL is resolved again, now against the real routes, with their own layout and middleware. An admin URL that
// matches no screen is a 404, as before. Public pages never load the admin routes
export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp() as ReturnType<typeof useNuxtApp> & { _adminRoutes?: boolean }
  if (nuxtApp._adminRoutes || !(to.path === '/admin' || to.path.startsWith('/admin/'))) {
    return
  }
  const router = useRouter()
  const { adminRoutes } = await import('#build/admin-routes.mjs')
  for (const route of adminRoutes) {
    router.addRoute(route)
  }
  router.removeRoute('admin-bridge')
  nuxtApp._adminRoutes = true
  if (router.resolve(to.fullPath).matched.length === 0) {
    return abortNavigation(createError({ statusCode: 404, statusMessage: 'Page Not Found', fatal: true }))
  }
  return navigateTo(to.fullPath, { replace: true })
})
