// The motion director (storyboard-home §1, F10-T2): plain TypeScript, no Vue, so the chunk the page imports on demand
// shares nothing with the Vue runtime chunk (a Vue island made the bundler split that chunk, +1.1 kB on every route).
// After the load, when idle, and only when motion is allowed, it imports GSAP and the plugins asked for and runs
// `setup` in a gsap.context scoped to the element; it reverts when stopped and when the visitor turns motion off;
// ScrollTrigger refreshes once the fonts are ready. Nothing is imported with reduced motion
import { MOTION_OK_CLASS, MOTION_REDUCE_EVENT, MOTION_STARTED } from '#shared/design/motion'
import type { MotionApi, MotionPlugin } from './gsap'
import type { Scene, SceneName } from './scenes/types'
import { motionAllowed } from './preference'

const IDLE_TIMEOUT_MS = 2000

function whenIdle(run: () => void): () => void {
  let idle: number | undefined
  let timer: number | undefined
  const schedule = () => {
    if (typeof requestIdleCallback === 'function') {
      idle = requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS })
    }
    else {
      timer = window.setTimeout(run, 200)
    }
  }
  if (document.readyState === 'complete') {
    schedule()
  }
  else {
    addEventListener('load', schedule, { once: true })
  }
  return () => {
    removeEventListener('load', schedule)
    if (idle !== undefined) {
      cancelIdleCallback(idle)
    }
    clearTimeout(timer)
  }
}

export interface MotionOptions {
  plugins?: readonly MotionPlugin[]
  /** Overridable in tests */
  load?: (plugins: readonly MotionPlugin[]) => Promise<MotionApi>
}

/** Starts the motion of a page (a scene by name, or a function in tests); returns the stop to call on unmount */
export function startMotion(scope: () => Element | null, scene: SceneName | Scene, options: MotionOptions = {}): () => void {
  let context: { revert: () => void } | undefined
  let stopped = false
  const revert = () => {
    context?.revert()
    context = undefined
  }

  async function start() {
    if (stopped || !motionAllowed()) {
      return
    }
    const load = options.load ?? (await import('./gsap')).loadGsap
    const [api, setup] = await Promise.all([
      load(options.plugins ?? []),
      typeof scene === 'function' ? scene : import('./scenes/index').then(module => module.loadScene(scene)),
    ])
    const element = scope()
    if (stopped || !motionAllowed() || !element || !setup) {
      return
    }
    const root = document.documentElement
    // After the 3 s fallback the content is already shown: the class stays off and the opening entrances are skipped
    const entrance = root.classList.contains(MOTION_OK_CLASS)
    root.dataset.motion = MOTION_STARTED
    context = api.gsap.context(() => setup({ ...api, scope: element, entrance }), element)
    if (api.ScrollTrigger) {
      void document.fonts.ready.then(() => api.ScrollTrigger?.refresh())
    }
  }

  if (!motionAllowed()) {
    return () => {}
  }
  addEventListener(MOTION_REDUCE_EVENT, revert)
  const cancelIdle = whenIdle(() => void start())
  return () => {
    stopped = true
    cancelIdle()
    removeEventListener(MOTION_REDUCE_EVENT, revert)
    revert()
  }
}
