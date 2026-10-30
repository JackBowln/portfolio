// Admin-only. Autosave (F06-T2, ADR-0006 §3): a save 2 s after the last change, one at a time (changes made during a
// save are saved right after it), retries after a failed request, and a pause the caller ends when a save cannot go
// through by itself (a conflict, an invalid field). `flush` saves now and waits, before leaving the page
import type { Ref } from 'vue'

export type SaveOutcome = 'saved' | 'conflict' | 'invalid' | 'error'
export type AutosaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'retrying' | 'paused'

export const AUTOSAVE_DELAY_MS = 2000
const RETRY_DELAYS_MS = [5000, 15000, 30000]

export function useAutosave(options: { dirty: Ref<boolean>, save: () => Promise<SaveOutcome>, delay?: number }) {
  const state = ref<AutosaveState>('idle')
  const savedAt = ref<Date | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | null = null
  let failures = 0

  function schedule(delay = options.delay ?? AUTOSAVE_DELAY_MS) {
    clearTimeout(timer)
    timer = setTimeout(() => void run(), delay)
  }

  async function run(): Promise<void> {
    clearTimeout(timer)
    if (running) {
      return running
    }
    if (!options.dirty.value || state.value === 'paused') {
      return
    }
    state.value = 'saving'
    running = (async () => {
      const outcome = await options.save()
      if (outcome === 'saved') {
        failures = 0
        savedAt.value = new Date()
        state.value = 'saved'
      }
      else if (outcome === 'error') {
        state.value = 'retrying'
        schedule(RETRY_DELAYS_MS[Math.min(failures++, RETRY_DELAYS_MS.length - 1)])
      }
      else {
        state.value = 'paused'
      }
    })()
    try {
      await running
    }
    finally {
      running = null
    }
    // Changes typed while saving (the state changed inside the awaited save)
    if ((state.value as AutosaveState) === 'saved' && options.dirty.value) {
      state.value = 'pending'
      schedule()
    }
  }

  /** Call on every edit */
  function changed() {
    if (state.value === 'paused') {
      return
    }
    if (options.dirty.value) {
      if (state.value !== 'saving' && state.value !== 'retrying') {
        state.value = 'pending'
      }
      if (state.value !== 'saving') {
        schedule()
      }
    }
  }

  /** Saves pending changes now and waits; used before leaving and by "save now" */
  async function flush(): Promise<void> {
    if (running) {
      await running
    }
    await run()
  }

  /** Ends a pause (conflict resolved, field fixed) and saves what is pending */
  function resume() {
    if (state.value === 'paused') {
      state.value = options.dirty.value ? 'pending' : 'idle'
      if (options.dirty.value) {
        schedule(0)
      }
    }
  }

  function pause() {
    clearTimeout(timer)
    state.value = 'paused'
  }

  onBeforeUnmount(() => clearTimeout(timer))

  return { state, savedAt, changed, flush, resume, pause }
}
