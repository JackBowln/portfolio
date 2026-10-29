// Admin-only. Messages between the admin page and the image pipeline Web Worker (ADR-0007 §2). Every byte array
// travels as a transferred ArrayBuffer, so nothing is copied between threads
import type { ImageFormat, ImageManifest } from '#shared/media/schemas'

export const PIPELINE_STAGES = ['decode', 'original', 'variants', 'placeholder'] as const
export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export interface PipelineRequest {
  type: 'process'
  file: File
}

export interface PipelineFile {
  /** Upload name the API expects: `original` or `{format}-{width}` */
  name: string
  contentType: string
  bytes: ArrayBuffer
}

export interface PipelineResult {
  manifest: ImageManifest
  files: PipelineFile[]
  /** Milliseconds per stage, for the performance log */
  timings: Record<PipelineStage, number>
}

export type PipelineMessage
  = | { type: 'progress', stage: PipelineStage, done: number, total: number }
    | { type: 'result', result: PipelineResult }
    | { type: 'error', code: 'unsupported' | 'too_large' | 'failed', message: string }

export interface EncodedVariant {
  format: ImageFormat
  width: number
  height: number
  bytes: ArrayBuffer
}
