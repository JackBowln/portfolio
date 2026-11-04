// F10-T2 (+ F10-T3): motion is imported only when allowed. With reduced motion (the system or the site's button) the director
// and GSAP are never loaded; the director reverts its context when stopped and when motion is turned off; the
// "Reduce motion" button only reduces: pressed and disabled when the system already asks for it
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import ReduceMotionToggle from '~/components/layout/ReduceMotionToggle.vue'
import { startMotion } from '~/composables/motion/director'
import { MOTION_OK_CLASS, MOTION_REDUCE_EVENT, MOTION_STORAGE_KEY } from '#shared/design/motion'

function mockReducedMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced, addEventListener: () => {}, removeEventListener: () => {} })))
}

function fakeGsap() {
  const revert = vi.fn()
  const setup = vi.fn()
  const load = vi.fn(async () => ({ gsap: { context: (run: () => void) => {
    run()
    return { revert }
  } }, ScrollTrigger: undefined, SplitText: undefined }) as never)
  return { revert, setup, load }
}

const idle = () => new Promise(resolve => setTimeout(resolve, 300))

describe('motion director', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove(MOTION_OK_CLASS)
    delete document.documentElement.dataset.motion
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('never loads GSAP with reduced motion from the system or the button', async () => {
    mockReducedMotion(true)
    const system = fakeGsap()
    startMotion(() => document.body, system.setup, { load: system.load })
    mockReducedMotion(false)
    localStorage.setItem(MOTION_STORAGE_KEY, '1')
    const button = fakeGsap()
    startMotion(() => document.body, button.setup, { load: button.load })
    await idle()
    expect(system.load).not.toHaveBeenCalled()
    expect(button.load).not.toHaveBeenCalled()
  })

  it('loads after idle, runs the setup in a context, and reverts on stop and when motion is turned off', async () => {
    mockReducedMotion(false)
    // As the inline script leaves it when motion is allowed
    document.documentElement.classList.add(MOTION_OK_CLASS)
    const first = fakeGsap()
    const stop = startMotion(() => document.body, first.setup, { load: first.load, plugins: ['ScrollTrigger'] })
    await idle()
    expect(first.load).toHaveBeenCalledWith(['ScrollTrigger'])
    expect(first.setup).toHaveBeenCalledWith(expect.objectContaining({ scope: document.body, entrance: true }))
    expect(document.documentElement.classList.contains(MOTION_OK_CLASS)).toBe(true)
    expect(document.documentElement.dataset.motion).toBe('started')
    stop()
    expect(first.revert).toHaveBeenCalledOnce()

    const second = fakeGsap()
    startMotion(() => document.body, second.setup, { load: second.load })
    await idle()
    dispatchEvent(new Event(MOTION_REDUCE_EVENT))
    expect(second.revert).toHaveBeenCalledOnce()
  })

  it('after the 3 s fallback, keeps the content shown: no class again and no opening entrances', async () => {
    mockReducedMotion(false)
    const motion = fakeGsap()
    startMotion(() => document.body, motion.setup, { load: motion.load })
    await idle()
    expect(motion.setup).toHaveBeenCalledWith(expect.objectContaining({ entrance: false }))
    expect(document.documentElement.classList.contains(MOTION_OK_CLASS)).toBe(false)
  })

  it('does nothing when stopped before it starts', async () => {
    mockReducedMotion(false)
    const motion = fakeGsap()
    startMotion(() => document.body, motion.setup, { load: motion.load })()
    await idle()
    expect(motion.load).not.toHaveBeenCalled()
  })
})

describe('reduce motion button', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.reduceMotion
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('toggles the stored choice and turns motion off at once', async () => {
    mockReducedMotion(false)
    document.documentElement.classList.add(MOTION_OK_CLASS)
    const reverted = vi.fn()
    addEventListener(MOTION_REDUCE_EVENT, reverted)
    const wrapper = await mountSuspended(defineComponent({ render: () => h(ReduceMotionToggle) }))
    const button = wrapper.get('button')
    expect(button.attributes('aria-pressed')).toBe('false')
    await button.trigger('click')
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(localStorage.getItem(MOTION_STORAGE_KEY)).toBe('1')
    expect(document.documentElement.classList.contains(MOTION_OK_CLASS)).toBe(false)
    expect(document.documentElement.dataset.reduceMotion).toBe('1')
    expect(reverted).toHaveBeenCalledOnce()
    await button.trigger('click')
    expect(localStorage.getItem(MOTION_STORAGE_KEY)).toBeNull()
    removeEventListener(MOTION_REDUCE_EVENT, reverted)
    wrapper.unmount()
  })

  it('is pressed and disabled, with a reason, when the system reduces motion', async () => {
    mockReducedMotion(true)
    const wrapper = await mountSuspended(defineComponent({ render: () => h(ReduceMotionToggle) }))
    const button = wrapper.get('button')
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Seu sistema já pede movimento reduzido.')
    wrapper.unmount()
  })
})
