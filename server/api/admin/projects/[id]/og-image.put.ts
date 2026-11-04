// Sets the generated share image of one localization (F11-T2): only that field, on top of the version read (409 on
// "version" when it changed), and only a ready image (400). Answers with the project, so the editor takes the new version.
// The same rule as a save: an author sets it only on their own projects
import { z } from 'zod'
import { shareImageSchema } from '#shared/content/article-input'
import { getProject } from '../../../../services/content/projects.service.ts'
import { setShareImage } from '../../../../services/content/share-image.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { project: ['update'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const { locale, version, mediaId } = await readValidatedBodyStrict(event, shareImageSchema)
    const db = useDb(event)
    const item = await getProject(db, id)
    assertOwnership(event, { project: ['update'] }, { authorId: item.authorId })
    await setShareImage(db, auth.user.id, { type: 'project', item }, locale, { version, mediaId })
    return getProject(db, id)
  },
})
