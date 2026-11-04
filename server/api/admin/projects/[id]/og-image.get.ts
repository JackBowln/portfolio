// What the admin needs to draw the share image of one localization (F11-T2): its title, the site's name, the
// version, and the current image with its file name (a generated one is named after the project and locale)
import { z } from 'zod'
import { articleLocaleSchema } from '#shared/content/article-input'
import { getProject } from '../../../../services/content/projects.service.ts'
import { shareImageState } from '../../../../services/content/share-image.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { project: ['read'] },
  handler: async (event) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const { locale } = getValidatedQueryStrict(event, articleLocaleSchema)
    const db = useDb(event)
    return shareImageState(db, { type: 'project', item: await getProject(db, id) }, locale)
  },
})
