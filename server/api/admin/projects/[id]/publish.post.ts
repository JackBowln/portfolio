// Publish a project localization now (F07-T1, RF-05.4): the same atomic batch as articles, then the purge of
// ADR-0003's tags. 409 with the reason when a guard fails (image without alt, slug taken on the site…)
import { z } from 'zod'
import { articlePublishSchema } from '#shared/content/article-input'
import { getProject, publishProject } from '../../../../services/content/projects.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { project: ['publish'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const { locale, version } = await readValidatedBodyStrict(event, articlePublishSchema)
    const db = useDb(event)
    const { article: project, purge } = await publishProject(db, publishActor(event, auth.user.id), await getProject(db, id), locale, version)
    await purgeAfterWrite(event, purge)
    return project
  },
})
