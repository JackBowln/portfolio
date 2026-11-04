// The "Reduce motion" button's state (storyboard-home §10, decision 4; F10-T2 decision 2): the button only reduces.
// When the system already asks for reduced motion it shows pressed and disabled. Turning it on removes the motion
// class at once, reverts running animations and keeps GSAP from loading anywhere; it is stored in localStorage
import { MOTION_OK_CLASS, MOTION_REDUCE_EVENT, MOTION_STORAGE_KEY, REDUCED_MOTION_QUERY } from '#shared/design/motion'
import { storedReducesMotion, systemReducesMotion } from './preference'

export function useReducedMotion() {
  const ready = ref(false)
  const system = ref(false)
  const stored = ref(false)
  let media: MediaQueryList | undefined
  const sync = () => {
    system.value = systemReducesMotion()
  }

  onMounted(() => {
    sync()
    stored.value = storedReducesMotion() && localStorageWorks()
    media = typeof matchMedia === 'function' ? matchMedia(REDUCED_MOTION_QUERY) : undefined
    media?.addEventListener('change', sync)
    ready.value = true
  })
  onBeforeUnmount(() => media?.removeEventListener('change', sync))

  function toggle() {
    const next = !stored.value
    const root = document.documentElement
    try {
      if (next) {
        localStorage.setItem(MOTION_STORAGE_KEY, '1')
      }
      else {
        localStorage.removeItem(MOTION_STORAGE_KEY)
      }
    }
    catch {
      // The choice still applies to this page
    }
    stored.value = next
    if (next) {
      root.dataset.reduceMotion = '1'
      root.classList.remove(MOTION_OK_CLASS)
      dispatchEvent(new Event(MOTION_REDUCE_EVENT))
    }
    else {
      delete root.dataset.reduceMotion
    }
  }

  return { ready, system, stored, reduced: computed(() => system.value || stored.value), toggle }
}

function localStorageWorks(): boolean {
  try {
    localStorage.getItem(MOTION_STORAGE_KEY)
    return true
  }
  catch {
    return false
  }
}
