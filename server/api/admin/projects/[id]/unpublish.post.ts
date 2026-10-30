// Take a project localization off the site (F07-T1); pt-BR takes its published translations with it. Revisions stay
import { z } from 'zod'
import { articleLocaleSchema } from '#shared/content/article-input'
import { getProject, unpublishProject } from '../../../../services/content/projects.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { project: ['publish'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const { locale } = await readValidatedBodyStrict(event, articleLocaleSchema)
    const db = useDb(event)
    const { article: project, purge } = await unpublishProject(db, publishActor(event, auth.user.id), await getProject(db, id), locale)
    await purgeAfterWrite(event, purge)
    return project
  },
})
