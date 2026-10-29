// Metadata only (RF-06.4): focal point, the explicit decorative flag and alt, caption and credit per locale.
// An empty alt is accepted here; publishing (F05/F06) refuses informative images without one
import { z } from 'zod'
import { LOCALES } from '#shared/types/enums'
import { updateMediaMetadata } from '../../../../services/media/media.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

const localization = z.object({
  alt: z.string().trim().max(1000).optional(),
  caption: z.string().trim().max(2000).nullable().optional(),
  credit: z.string().trim().max(300).nullable().optional(),
}).strict().refine(fields => Object.keys(fields).length > 0, 'Nothing to update')

const bodySchema = z.object({
  focalX: z.number().min(0).max(1).optional(),
  focalY: z.number().min(0).max(1).optional(),
  decorative: z.boolean().optional(),
  localizations: z.partialRecord(z.enum(LOCALES), localization).optional(),
}).refine(body => Object.keys(body).length > 0, 'Nothing to update')

export default defineAdminHandler({
  permission: { media: ['update'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const body = await readValidatedBodyStrict(event, bodySchema)
    const media = await updateMediaMetadata(useDb(event), auth.user.id, id, body)
    const fields = [
      ...['focalX', 'focalY', 'decorative'].filter(field => field in body),
      ...Object.keys(body.localizations ?? {}).map(locale => `localization:${locale}`),
    ]
    await auditRequest(event, { action: 'media.updated', entityType: 'media', entityId: id, metadata: { fields: fields.join(',') } })
    return media
  },
})
