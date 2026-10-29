// Admin-only. What the video manifest needs from a file the browser does not transcode (ADR-0007 §4): its size and
// duration from the <video> metadata, and the SHA-256 of its bytes
import { toHex } from '#shared/media/pipeline'
import { MEDIA_LIMITS, VIDEO_MIME_TYPES } from '#shared/media/schemas'

export class VideoFileError extends Error {
  constructor(readonly code: 'unsupported' | 'tooLarge' | 'unreadable') {
    super(code)
  }
}

export interface VideoFileInfo {
  mimeType: (typeof VIDEO_MIME_TYPES)[number]
  width: number
  height: number
  durationMs: number
  sha256: string
}

function once(target: EventTarget, events: string[]): Promise<Event> {
  return new Promise((resolve, reject) => {
    const done = (event: Event) => {
      events.forEach(name => target.removeEventListener(name, done))
      target.removeEventListener('error', fail)
      resolve(event)
    }
    const fail = () => reject(new VideoFileError('unreadable'))
    events.forEach(name => target.addEventListener(name, done))
    target.addEventListener('error', fail)
  })
}

/** Width, height and duration; files without a duration in their header (MediaRecorder WebM) are seeked to the end */
async function readMetadata(file: File): Promise<{ width: number, height: number, durationMs: number }> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  try {
    video.src = url
    await once(video, ['loadedmetadata'])
    if (!Number.isFinite(video.duration)) {
      video.currentTime = Number.MAX_SAFE_INTEGER
      await once(video, ['durationchange', 'timeupdate'])
      while (!Number.isFinite(video.duration)) {
        await once(video, ['durationchange'])
      }
    }
    if (!video.videoWidth || !video.videoHeight || !(video.duration > 0)) {
      throw new VideoFileError('unreadable')
    }
    return { width: video.videoWidth, height: video.videoHeight, durationMs: Math.round(video.duration * 1000) }
  }
  finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}

export function useVideoFile() {
  const stage = ref<'reading' | 'hashing' | null>(null)

  async function inspect(file: File): Promise<VideoFileInfo> {
    const mimeType = file.type as VideoFileInfo['mimeType']
    if (!(VIDEO_MIME_TYPES as readonly string[]).includes(mimeType)) {
      throw new VideoFileError('unsupported')
    }
    if (file.size > MEDIA_LIMITS.videoBytes) {
      throw new VideoFileError('tooLarge')
    }
    try {
      stage.value = 'reading'
      const metadata = await readMetadata(file)
      stage.value = 'hashing'
      const sha256 = toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())))
      return { mimeType, ...metadata, sha256 }
    }
    finally {
      stage.value = null
    }
  }

  return { stage: readonly(stage), inspect }
}
