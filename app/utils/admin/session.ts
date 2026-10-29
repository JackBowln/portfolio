// Admin-only (boundaries: app/**/admin/**). The signed-in user as the admin shell shows it. The server decides
// every permission; this state only labels the header and hides links
export interface AdminUser {
  name: string
  role: string
}

export const useAdminUser = () => useState<AdminUser | null>('admin:user', () => null)

/** $fetch for /api/admin: a 401 (session ended or revoked) sends the user back to the login page */
export const adminFetch = $fetch.create({
  async onResponseError({ response }) {
    if (response.status === 401) {
      useAdminUser().value = null
      await navigateTo('/admin/login')
    }
  },
})
