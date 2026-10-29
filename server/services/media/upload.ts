// Streams one upload into R2 without buffering it (ADR-0007 §3): the head is read first and inspected, then
// written back in front of the rest. FixedLengthStream gives R2 the length it needs and fails when the body is
// longer or shorter than declared, so the stored object always has the size the manifest promised
import { containsMarkup, sniffMediaType, SNIFF_BYTES } from '../../utils/magic-bytes.ts'
import type { MediaMimeType } from '../../../shared/media/schemas.ts'

export type UploadRejection = 'type_mismatch' | 'markup' | 'size_mismatch'

export class UploadRejectedError extends Error {
  constructor(readonly reason: UploadRejection) {
    super(`Upload rejected: ${reason}`)
  }
}

async function readHead(reader: ReadableStreamDefaultReader<Uint8Array>, bytes: number): Promise<{ head: Uint8Array, done: boolean }> {
  const chunks: Uint8Array[] = []
  let length = 0
  while (length < bytes) {
    const { done, value } = await reader.read()
    if (done) {
      return { head: concat(chunks, length), done: true }
    }
    chunks.push(value)
    length += value.byteLength
  }
  return { head: concat(chunks, length), done: false }
}

function concat(chunks: Uint8Array[], length: number): Uint8Array {
  const out = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

/** The bytes must be `contentType` and carry no markup in their head; the body must be exactly `length` bytes */
export async function streamUploadToR2(bucket: R2Bucket, key: string, body: ReadableStream<Uint8Array>, length: number, contentType: MediaMimeType): Promise<void> {
  const reader = body.getReader()
  const { head, done } = await readHead(reader, SNIFF_BYTES)
  const inspected = head.subarray(0, SNIFF_BYTES)
  if (sniffMediaType(inspected) !== contentType) {
    await reader.cancel()
    throw new UploadRejectedError('type_mismatch')
  }
  if (containsMarkup(inspected)) {
    await reader.cancel()
    throw new UploadRejectedError('markup')
  }
  if (head.byteLength > length || (done && head.byteLength !== length)) {
    await reader.cancel()
    throw new UploadRejectedError('size_mismatch')
  }

  const { readable, writable } = new FixedLengthStream(length)
  const writer = writable.getWriter()
  let received = head.byteLength
  const pump = (async () => {
    await writer.write(head)
    for (;;) {
      const { done: finished, value } = await reader.read()
      if (finished) {
        break
      }
      received += value.byteLength
      await writer.write(value)
    }
    await writer.close()
  })()
  try {
    await Promise.all([bucket.put(key, readable, { httpMetadata: { contentType } }), pump])
  }
  catch (error) {
    await reader.cancel().catch(() => {})
    await writer.abort().catch(() => {})
    // A wrong length surfaces as a stream error; anything else (R2 itself) is not the client's fault
    if (received !== length) {
      throw new UploadRejectedError('size_mismatch')
    }
    throw error
  }
}
