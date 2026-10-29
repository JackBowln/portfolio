// Admin-only. Sends a media item through the F04-T1 API: manifest, one PUT per file (the server names and keys
// them), then finalize. Images come from the pipeline, videos straight from the file input. Abort stops the requests
// in flight; an unfinished item stays pending for the cleanup
import type { MediaManifest } from '#shared/media/schemas'
import { adminFetch } from '~/utils/admin/session'

export interface UploadPlan {
  manifest: MediaManifest
  files: { name: string, bytes: ArrayBuffer | Blob }[]
}

interface CreatedMedia {
  id: string
  uploads: { name: string, contentType: string, size: number }[]
}

export function useMediaUpload() {
  const sent = ref(0)
  const total = ref(0)
  let controller: AbortController | null = null

  async function upload(result: UploadPlan): Promise<string> {
    controller = new AbortController()
    const { signal } = controller
    const created = await adminFetch<CreatedMedia>('/api/admin/media', { method: 'POST', body: result.manifest, signal })
    const files = new Map(result.files.map(file => [file.name, file]))
    sent.value = 0
    total.value = created.uploads.length
    for (const expected of created.uploads) {
      const file = files.get(expected.name)
      if (!file) {
        throw new Error(`The pipeline did not produce ${expected.name}`)
      }
      await adminFetch(`/api/admin/media/${encodeURIComponent(created.id)}/variants/${encodeURIComponent(expected.name)}`, {
        method: 'PUT',
        headers: { 'content-type': expected.contentType },
        body: new Blob([file.bytes], { type: expected.contentType }),
        signal,
      })
      sent.value++
    }
    await adminFetch(`/api/admin/media/${encodeURIComponent(created.id)}/finalize`, { method: 'POST', signal })
    return created.id
  }

  function abort() {
    controller?.abort()
    controller = null
  }

  onScopeDispose(abort)
  return { sent: readonly(sent), total: readonly(total), upload, abort }
}
