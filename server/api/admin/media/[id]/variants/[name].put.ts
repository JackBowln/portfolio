// One file of the manifest, streamed to R2 (ADR-0007 §3). The name must be one the manifest produced; the
// Content-Type and Content-Length must be the declared ones; the bytes must be that type and carry no markup.
// Content rejections are audited: they are what a malicious upload looks like
import { z } from 'zod'
import { uploadMediaFile } from '../../../../../services/media/media.service.ts'
import { UploadRejectedError } from '../../../../../services/media/upload.ts'

const paramsSchema = z.object({
  id: z.string().min(1).max(64),
  // Variant names (avif-640) and track names (captions-pt-BR); never a path
  name: z.string().regex(/^[A-Za-z0-9-]{1,32}$/, 'Upload name'),
})

export default defineAdminHandler({
  permission: { media: ['create'] },
  handler: async (event, auth) => {
    const { id, name } = getValidatedParamsStrict(event, paramsSchema)
    try {
      return await uploadMediaFile(useDb(event), useEnv(event).MEDIA, auth.user.id, id, {
        name,
        contentType: getRequestHeader(event, 'content-type'),
        contentLength: getRequestHeader(event, 'content-length'),
        body: getRequestWebStream(event),
      })
    }
    catch (error) {
      if (!(error instanceof UploadRejectedError)) {
        throw error
      }
      await auditRequest(event, { action: 'media.upload_rejected', entityType: 'media', entityId: id, metadata: { upload: name, reason: error.reason } })
      throw error.reason === 'size_mismatch'
        ? createAppError('bad_request', 'Body size does not match the declared size')
        : createAppError('unsupported_media_type', 'Content does not match its type')
    }
  },
})
