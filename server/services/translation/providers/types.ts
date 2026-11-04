// The translation provider interface (F09-T3, ADR-0009 §2). A provider estimates a batch and translates it; the run
// service decides what is sent (the segmenter's tagged text, never anything else) and checks the cost guard first
import type { Segment } from '../../../../shared/content/segmenter.ts'
import type { Locale } from '../../../../shared/types/enums.ts'

export interface TranslationRequest {
  targetLocale: Locale
  segments: readonly Segment[]
  /** Glossary translations of the target locale, for the prompt */
  glossary: readonly { term: string, translation: string }[]
  formality: 'formal' | 'informal'
  notes?: string | undefined
}

export interface Estimate {
  inputTokens: number
  outputTokens: number
  neurons: number
  costMicroUsd: number
}

export interface Usage extends Estimate {
  /** The provider did not report its usage; these are the estimate's numbers */
  estimated: boolean
}

export interface TranslationResult {
  segments: { id: string, text: string }[]
  usage: Usage
}

export interface TranslationProvider {
  readonly id: string
  readonly model: string
  estimate: (request: TranslationRequest) => Estimate
  translate: (request: TranslationRequest) => Promise<TranslationResult>
}

/** A provider failure the run records on the job: a stable code and a short message, never the provider's text */
export class ProviderError extends Error {
  constructor(readonly code: 'unavailable' | 'invalid_output' | 'rate_limited', message: string) {
    super(message)
  }
}

/** ~4 characters per token, rounded up: the guard errs on the safe side */
export const tokensOf = (text: string) => Math.ceil(text.length / 4)
