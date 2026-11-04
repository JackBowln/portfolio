// Workers AI models the translation can use (F09-T3, ADR-0009 §5) and what each costs in neurons per million tokens
// (Workers AI pricing, research 2026-10-25). The estimate and the cost guard depend on these rates, so a model
// outside this list cannot be configured. The default comes from the evaluation recorded in ADR-0009
export const AI_MODELS = {
  '@cf/openai/gpt-oss-120b': { input: 31_818, output: 68_182 },
  '@cf/google/gemma-4-26b-a4b-it': { input: 9_091, output: 27_273 },
  '@cf/qwen/qwen3-30b-a3b-fp8': { input: 4_625, output: 30_475 },
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': { input: 26_668, output: 204_805 },
} as const satisfies Record<string, { input: number, output: number }>

export type AiModel = keyof typeof AI_MODELS
export const AI_MODEL_IDS = Object.keys(AI_MODELS) as [AiModel, ...AiModel[]]

/** Neurons for a number of tokens, rounded up: the guard errs on the safe side */
export function neuronsFor(model: AiModel, inputTokens: number, outputTokens: number): number {
  const rates = AI_MODELS[model]
  return Math.ceil((inputTokens * rates.input + outputTokens * rates.output) / 1_000_000)
}
