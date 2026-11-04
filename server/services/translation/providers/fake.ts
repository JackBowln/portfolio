// The fake provider (F09-T3): deterministic, no network, for tests and the test build only (never in preview or
// production, see provider.ts). It "translates" by prefixing the locale and keeps every tag; it can fail on a given
// call, drop a tag in a segment, or report no usage, to exercise the run's failure paths
import type { TranslationProvider, TranslationRequest } from './types.ts'
import { ProviderError, tokensOf } from './types.ts'

export interface FakeOptions {
  /** 1-based call numbers that throw */
  failOnCalls?: readonly number[]
  /** Segment ids whose translation loses its tags */
  breakTags?: readonly string[]
  reportUsage?: boolean
}

export function createFakeProvider(options: FakeOptions = {}): TranslationProvider & { calls: TranslationRequest[] } {
  const calls: TranslationRequest[] = []
  const estimate = (request: TranslationRequest) => {
    const inputTokens = request.segments.reduce((sum, segment) => sum + tokensOf(segment.text), 50)
    return { inputTokens, outputTokens: inputTokens, neurons: Math.ceil(inputTokens / 10), costMicroUsd: 0 }
  }
  return {
    id: 'fake',
    model: 'fake',
    calls,
    estimate,
    async translate(request) {
      calls.push(request)
      if (options.failOnCalls?.includes(calls.length)) {
        throw new ProviderError('unavailable', 'Fake provider failure')
      }
      const segments = request.segments.map(segment => ({
        id: segment.id,
        text: options.breakTags?.includes(segment.id)
          ? segment.text.replace(/<[^>]+>/g, '')
          : segment.text.replace(/(^|>)([^<]+)/g, (_, tag: string, words: string) => `${tag}[${request.targetLocale}] ${words}`),
      }))
      const planned = estimate(request)
      return { segments, usage: { ...planned, estimated: options.reportUsage === false } }
    },
  }
}
