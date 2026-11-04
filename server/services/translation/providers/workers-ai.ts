// Workers AI (F09-T3, ADR-0009): the AI binding with JSON structured output. Neurons come from the model's rates
// (shared/translation/models.ts) applied to the usage the model reports, or to the estimate when it reports none;
// the larger of the two is recorded, so the ledger never undercounts. Costs no money on the Free plan
import type { AiModel } from '../../../../shared/translation/models.ts'
import { neuronsFor } from '../../../../shared/translation/models.ts'
import { outputJsonSchema, outputSchema, systemPrompt, userMessage } from './prompt.ts'
import type { Estimate, TranslationProvider, TranslationRequest, TranslationResult } from './types.ts'
import { ProviderError, tokensOf } from './types.ts'

interface AiRunner {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>
}

// Translations run a little longer than the source; the JSON wrapping adds a little more
const OUTPUT_RATIO = 1.3

export function createWorkersAiProvider(ai: AiRunner, model: AiModel): TranslationProvider {
  const estimate = (request: TranslationRequest): Estimate => {
    const inputTokens = tokensOf(systemPrompt(request)) + tokensOf(userMessage(request))
    const outputTokens = Math.ceil(tokensOf(userMessage(request)) * OUTPUT_RATIO)
    return { inputTokens, outputTokens, neurons: neuronsFor(model, inputTokens, outputTokens), costMicroUsd: 0 }
  }

  return {
    id: 'workers-ai',
    model,
    estimate,
    async translate(request): Promise<TranslationResult> {
      let answer: unknown
      try {
        answer = await ai.run(model, {
          messages: [{ role: 'system', content: systemPrompt(request) }, { role: 'user', content: userMessage(request) }],
          response_format: { type: 'json_schema', json_schema: outputJsonSchema },
          max_tokens: Math.max(1024, estimate(request).outputTokens * 2),
        })
      }
      catch (error) {
        const limited = error instanceof Error && /\b(429|rate|limit|capacity)\b/i.test(error.message)
        throw new ProviderError(limited ? 'rate_limited' : 'unavailable', limited ? 'Workers AI limit reached' : 'Workers AI did not answer')
      }
      const body = answer as { response?: unknown, usage?: { prompt_tokens?: number, completion_tokens?: number } }
      const raw = typeof body.response === 'string' ? safeJson(body.response) : body.response
      const parsed = outputSchema.safeParse(raw)
      if (!parsed.success) {
        throw new ProviderError('invalid_output', 'The model answer was not the expected JSON')
      }
      const planned = estimate(request)
      const reported = body.usage?.prompt_tokens !== undefined && body.usage.completion_tokens !== undefined
      const inputTokens = reported ? body.usage!.prompt_tokens! : planned.inputTokens
      const outputTokens = reported ? body.usage!.completion_tokens! : planned.outputTokens
      return {
        segments: parsed.data.segments,
        usage: { inputTokens, outputTokens, neurons: Math.max(neuronsFor(model, inputTokens, outputTokens), reported ? 0 : planned.neurons), costMicroUsd: 0, estimated: !reported },
      }
    },
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  }
  catch {
    return undefined
  }
}
