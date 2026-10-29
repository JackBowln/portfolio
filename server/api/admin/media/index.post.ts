// Starts an upload (ADR-0007 §3): registers the manifest as a pending item and answers with the files to send
import { mediaManifestSchema } from '#shared/media/schemas'
import { createMedia } from '../../../services/media/media.service.ts'

export default defineAdminHandler({
  permission: { media: ['create'] },
  handler: async (event, auth) => {
    const manifest = await readValidatedUnionBody(event, mediaManifestSchema)
    const created = await createMedia(useDb(event), auth.user.id, manifest)
    await auditRequest(event, {
      action: 'media.created',
      entityType: 'media',
      entityId: created.id,
      metadata: { kind: manifest.kind, mimeType: manifest.mimeType, uploads: created.uploads.length },
    })
    setResponseStatus(event, 201)
    return created
  },
})
