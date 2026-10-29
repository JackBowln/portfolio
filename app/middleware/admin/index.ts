// Admin route guard (UX only, ADR-0005 §6): without a session the screen sends the user to the login page; the
// server answers 401 to every /api/admin call anyway. Named, not global, so it stays out of the public bundle
import { authClient } from '~/utils/admin/auth-client'
import { useAdminUser } from '~/utils/admin/session'

export default defineNuxtRouteMiddleware(async () => {
  const { data } = await authClient.getSession()
  if (!data) {
    useAdminUser().value = null
    return navigateTo('/admin/login')
  }
  // The client has no admin plugin types; the role comes from the server's session (admin plugin field)
  useAdminUser().value = { name: data.user.name, role: (data.user as { role?: string | null }).role ?? '' }
})
