// Motion on a page (ADR-0011 §2, §5): the director (director.ts) is imported only after mount and only when motion is
// allowed, so a page with reduced motion never fetches it nor GSAP; it stops on unmount. The page's own content may
// never hydrate (hydrate-never): the director finds its targets in the DOM by data-motion
import type { MotionApi } from './gsap'
import type { MotionOptions } from './director'
import { motionAllowed } from './preference'

export function useMotion(scope: () => Element | null, setup: (api: MotionApi) => void, options: Omit<MotionOptions, 'load'> = {}) {
  let stop: (() => void) | undefined
  let unmounted = false
  onMounted(() => {
    if (!motionAllowed()) {
      return
    }
    void import('./director').then(({ startMotion }) => {
      if (!unmounted) {
        stop = startMotion(scope, setup, options)
      }
    })
  })
  onBeforeUnmount(() => {
    unmounted = true
    stop?.()
  })
}
