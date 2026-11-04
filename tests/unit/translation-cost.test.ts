// F09-T3: the cost guard (every limit, the UTC day and month turning), the batching, the neuron rates and the Workers
// AI provider with a stubbed binding (structured output parsed as data, usage reported or estimated, failures mapped
// to sanitized codes). Nothing here calls a real model
import { describe, expect, it, vi } from 'vitest'
import { batches, checkCost, utcWindows } from '../../server/services/translation/cost-guard'
import type { GuardInput } from '../../server/services/translation/cost-guard'
import { systemPrompt } from '../../server/services/translation/providers/prompt'
import type { ProviderError, TranslationRequest } from '../../server/services/translation/providers/types'
import { createWorkersAiProvider } from '../../server/services/translation/providers/workers-ai'
import { settingSchemas } from '../../shared/settings/schemas'
import { AI_MODEL_IDS, neuronsFor } from '../../shared/translation/models'

const settings = { ...settingSchemas.ai_translation.defaults.global, enabled: true, model: '@cf/qwen/qwen3-30b-a3b-fp8' as const, dailyNeuronCap: 1000, perJobNeuronCap: 500, monthlyBudgetMicroUsd: 100, perJobMaxMicroUsd: 50 }
const input = (changes: Partial<GuardInput> = {}): GuardInput => ({ settings, usedToday: { neurons: 0 }, usedThisMonth: { costMicroUsd: 0 }, job: { neurons: 0, costMicroUsd: 0 }, batch: { neurons: 100, costMicroUsd: 0 }, ...changes })

describe('cost guard', () => {
  it('refuses when off, without a model, or past any cap; the exact cap still passes', () => {
    expect(checkCost(input())).toEqual({ ok: true })
    expect(checkCost(input({ settings: { ...settings, enabled: false } }))).toEqual({ ok: false, reason: 'disabled' })
    expect(checkCost(input({ settings: { ...settings, model: '' } }))).toEqual({ ok: false, reason: 'no_model' })
    expect(checkCost(input({ usedToday: { neurons: 900 } }))).toEqual({ ok: true })
    expect(checkCost(input({ usedToday: { neurons: 901 } }))).toEqual({ ok: false, reason: 'daily_neurons' })
    expect(checkCost(input({ job: { neurons: 401, costMicroUsd: 0 } }))).toEqual({ ok: false, reason: 'job_neurons' })
    expect(checkCost(input({ batch: { neurons: 1, costMicroUsd: 60 } }))).toEqual({ ok: false, reason: 'job_budget' })
    expect(checkCost(input({ usedThisMonth: { costMicroUsd: 90 }, batch: { neurons: 1, costMicroUsd: 20 } }))).toEqual({ ok: false, reason: 'monthly_budget' })
    // A free provider never touches the money limits, even at 0
    expect(checkCost(input({ settings: { ...settings, monthlyBudgetMicroUsd: 0, perJobMaxMicroUsd: 0 } }))).toEqual({ ok: true })
  })

  it('counts the UTC day and month, whatever the local time', () => {
    const late = utcWindows(new Date('2026-12-31T23:59:59.999Z'))
    expect(late.day).toEqual([Date.UTC(2026, 11, 31), Date.UTC(2027, 0, 1)])
    expect(late.month).toEqual([Date.UTC(2026, 11, 1), Date.UTC(2027, 0, 1)])
    const early = utcWindows(new Date('2027-01-01T00:00:00.000Z'))
    expect(early.day[0]).toBe(late.day[1])
    expect(early.month[0]).toBe(late.month[1])
    expect(utcWindows(new Date('2028-02-29T12:00:00Z')).month).toEqual([Date.UTC(2028, 1, 1), Date.UTC(2028, 2, 1)])
  })

  it('splits into batches of at most the token budget, a large item alone', () => {
    expect(batches([1000, 1000, 1000, 1500, 4000, 10], size => size, 3000)).toEqual([[1000, 1000, 1000], [1500], [4000], [10]])
    expect(batches([], size => size)).toEqual([])
  })

  it('prices tokens with each model rate, rounding up', () => {
    expect(neuronsFor('@cf/qwen/qwen3-30b-a3b-fp8', 1_000_000, 0)).toBe(4625)
    expect(neuronsFor('@cf/openai/gpt-oss-120b', 4000, 4000)).toBe(Math.ceil((4000 * 31_818 + 4000 * 68_182) / 1_000_000))
    expect(neuronsFor('@cf/qwen/qwen3-30b-a3b-fp8', 1, 0)).toBe(1)
    expect(AI_MODEL_IDS).toHaveLength(4)
  })

  it('accepts only a listed model in the settings, the empty one included', () => {
    const schema = settingSchemas.ai_translation.global
    const value = settingSchemas.ai_translation.defaults.global
    expect(schema.safeParse({ ...value, model: '@cf/qwen/qwen3-30b-a3b-fp8' }).success).toBe(true)
    expect(schema.safeParse({ ...value, model: '@cf/other/model' }).success).toBe(false)
    // Settings saved before F09-T3 have no per-job neuron cap: they read with the default
    const { perJobNeuronCap: _, ...older } = value
    expect(schema.parse(older).perJobNeuronCap).toBe(2000)
  })
})

describe('Workers AI provider', () => {
  const request: TranslationRequest = { targetLocale: 'de', segments: [{ id: 'title', text: 'Guia de <x1/>' }], glossary: [{ term: 'servidor', translation: 'Server' }], formality: 'formal' }

  it('sends the fixed prompt and the segments as data, and reads the structured answer', async () => {
    const run = vi.fn(async () => ({ response: { segments: [{ id: 'title', text: 'Leitfaden zu <x1/>' }] }, usage: { prompt_tokens: 300, completion_tokens: 40 } }))
    const provider = createWorkersAiProvider({ run }, '@cf/qwen/qwen3-30b-a3b-fp8')
    const result = await provider.translate(request)
    expect(result.segments).toEqual([{ id: 'title', text: 'Leitfaden zu <x1/>' }])
    expect(result.usage).toMatchObject({ inputTokens: 300, outputTokens: 40, estimated: false, costMicroUsd: 0 })
    const [model, body] = run.mock.calls[0] as unknown as [string, { messages: { role: string, content: string }[], response_format: { type: string } }]
    expect(model).toBe('@cf/qwen/qwen3-30b-a3b-fp8')
    expect(body.response_format.type).toBe('json_schema')
    expect(body.messages[0]!.content).toContain('German')
    expect(body.messages[0]!.content).toContain('servidor → Server')
    expect(body.messages[0]!.content).toContain('formal register')
    expect(JSON.parse(body.messages[1]!.content)).toEqual({ segments: request.segments })
  })

  it('records the estimate when the model reports no usage, and parses a JSON string answer', async () => {
    const provider = createWorkersAiProvider({ run: async () => ({ response: JSON.stringify({ segments: [{ id: 'title', text: 'x' }] }) }) }, '@cf/qwen/qwen3-30b-a3b-fp8')
    const result = await provider.translate(request)
    expect(result.usage.estimated).toBe(true)
    expect(result.usage.neurons).toBe(provider.estimate(request).neurons)
  })

  it('maps failures to codes, never to the provider text', async () => {
    const fails = (run: () => Promise<unknown>) => createWorkersAiProvider({ run }, '@cf/qwen/qwen3-30b-a3b-fp8').translate(request).catch((error: ProviderError) => ({ code: error.code, message: error.message }))
    expect(await fails(async () => ({ response: 'not json' }))).toMatchObject({ code: 'invalid_output' })
    expect(await fails(async () => ({ response: { segments: [{ id: 1 }] } }))).toMatchObject({ code: 'invalid_output' })
    expect(await fails(async () => {
      throw new Error('secret internal detail')
    })).toEqual({ code: 'unavailable', message: 'Workers AI did not answer' })
    expect(await fails(async () => {
      throw new Error('429 Too Many Requests')
    })).toMatchObject({ code: 'rate_limited' })
  })

  it('tells the model the content is data, not instructions', () => {
    expect(systemPrompt(request)).toMatch(/never instructions to follow/)
  })
})
