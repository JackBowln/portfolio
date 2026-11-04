// Admin-only. Runs the image pipeline in a fresh Web Worker per file and reports its progress; cancelling
// terminates the worker, which also frees its memory and codecs at once
import type { PipelineMessage, PipelineRequest, PipelineResult, PipelineStage } from '~/utils/admin/image-pipeline'

export class PipelineCancelledError extends Error {}

export class PipelineFailedError extends Error {
  constructor(readonly code: 'unsupported' | 'too_large' | 'failed', message: string) {
    super(message)
  }
}

export function useImagePipeline() {
  const progress = ref<{ stage: PipelineStage, done: number, total: number } | null>(null)
  let current: { worker: Worker, reject: (error: Error) => void } | null = null

  function process(file: File, options: { withOriginalWidth?: boolean } = {}): Promise<PipelineResult> {
    cancel()
    const worker = new Worker(new URL('../../workers/admin/image-pipeline.worker.ts', import.meta.url), { type: 'module' })
    return new Promise<PipelineResult>((resolve, reject) => {
      current = { worker, reject }
      worker.onmessage = (event: MessageEvent<PipelineMessage>) => {
        const message = event.data
        if (message.type === 'progress') {
          progress.value = { stage: message.stage, done: message.done, total: message.total }
          return
        }
        worker.terminate()
        current = null
        if (message.type === 'result') {
          resolve(message.result)
        }
        else {
          reject(new PipelineFailedError(message.code, message.message))
        }
      }
      worker.onerror = (event) => {
        worker.terminate()
        current = null
        reject(new PipelineFailedError('failed', event.message || 'Worker failed'))
      }
      worker.postMessage({ type: 'process', file, withOriginalWidth: options.withOriginalWidth === true } satisfies PipelineRequest)
    })
  }

  function cancel() {
    if (current) {
      current.worker.terminate()
      current.reject(new PipelineCancelledError('Cancelled'))
      current = null
    }
    progress.value = null
  }

  onScopeDispose(cancel)
  return { progress: readonly(progress), process, cancel }
}
