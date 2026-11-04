// The cost guard (F09-T3, ADR-0009 §6): runs before every batch, on the batch's estimate and what the ledger already
// used today (UTC day) and this month (UTC month). Pure: the run service gives it the numbers. Any limit hit stops
// the job before the provider is called
import type { SettingGlobal } from '../../../shared/settings/schemas.ts'

export type GuardRefusal = 'disabled' | 'no_model' | 'daily_neurons' | 'monthly_budget' | 'job_neurons' | 'job_budget'

export interface GuardInput {
  settings: SettingGlobal<'ai_translation'>
  /** Neurons and money the ledger recorded today and this month, this job's earlier batches included */
  usedToday: { neurons: number }
  usedThisMonth: { costMicroUsd: number }
  /** What this job used so far, and what the next batch is estimated to use */
  job: { neurons: number, costMicroUsd: number }
  batch: { neurons: number, costMicroUsd: number }
}

export function checkCost(input: GuardInput): { ok: true } | { ok: false, reason: GuardRefusal } {
  const { settings, usedToday, usedThisMonth, job, batch } = input
  if (!settings.enabled) {
    return { ok: false, reason: 'disabled' }
  }
  if (!settings.model) {
    return { ok: false, reason: 'no_model' }
  }
  if (usedToday.neurons + batch.neurons > settings.dailyNeuronCap) {
    return { ok: false, reason: 'daily_neurons' }
  }
  if (job.neurons + batch.neurons > settings.perJobNeuronCap) {
    return { ok: false, reason: 'job_neurons' }
  }
  if (batch.costMicroUsd > 0 && usedThisMonth.costMicroUsd + batch.costMicroUsd > settings.monthlyBudgetMicroUsd) {
    return { ok: false, reason: 'monthly_budget' }
  }
  if (batch.costMicroUsd > 0 && job.costMicroUsd + batch.costMicroUsd > settings.perJobMaxMicroUsd) {
    return { ok: false, reason: 'job_budget' }
  }
  return { ok: true }
}

/** The UTC day and month a moment falls in, as [start, end) in ms */
export function utcWindows(now: Date): { day: [number, number], month: [number, number] } {
  const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  return {
    day: [dayStart, dayStart + 24 * 60 * 60 * 1000],
    month: [monthStart, Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)],
  }
}

/** Splits segments into batches of at most ~maxTokens each (a single larger segment goes alone) */
export function batches<T>(items: readonly T[], tokens: (item: T) => number, maxTokens = 3000): T[][] {
  const out: T[][] = []
  let current: T[] = []
  let size = 0
  for (const item of items) {
    const cost = tokens(item)
    if (current.length > 0 && size + cost > maxTokens) {
      out.push(current)
      current = []
      size = 0
    }
    current.push(item)
    size += cost
  }
  if (current.length > 0) {
    out.push(current)
  }
  return out
}
