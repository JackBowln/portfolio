// The case study's scene (storyboard-home §9, F10-T4): the gallery opens like the home's covers (a clip-path inset on
// desktop, a fade on mobile), and a highlight written as a number counts up once to its original text. While it
// counts, the moving digits are hidden from screen readers and the final value is read from a visually hidden copy;
// the original text comes back at the end and on revert. The cover is never animated: it is the LCP and the shared
// element of the page transition
import { BREAKPOINTS, DURATIONS } from '#shared/design/tokens'
import { formatCount, parseCount } from './count'
import type { SceneContext } from './types'

const EASE = { out: 'power3.out', emphasis: 'expo.out' } as const
const seconds = (ms: number) => ms / 1000

export function caseStudyScene({ gsap, scope }: SceneContext): (() => void) | undefined {
  const restores: (() => void)[] = []
  const media = gsap.matchMedia()

  media.add({ desktop: `(min-width: ${BREAKPOINTS.md}px)` }, (context) => {
    const { desktop } = context.conditions as { desktop: boolean }
    for (const image of scope.querySelectorAll<HTMLElement>('[data-motion="gallery"] picture')) {
      gsap.from(image, {
        ...(desktop ? { clipPath: 'inset(8% 8% 8% 8%)', scale: 1.04, ease: EASE.emphasis, duration: seconds(DURATIONS.slow), clearProps: 'clipPath,transform' } : { opacity: 0, ease: EASE.out, duration: seconds(DURATIONS.base) }),
        scrollTrigger: { trigger: image, start: 'top 85%', once: true },
      })
    }
  })

  for (const element of scope.querySelectorAll<HTMLElement>('[data-motion="highlight-value"]')) {
    const original = element.textContent?.trim() ?? ''
    const count = parseCount(original)
    if (!count) {
      continue
    }
    const visual = document.createElement('span')
    visual.setAttribute('aria-hidden', 'true')
    const spoken = document.createElement('span')
    spoken.className = 'sr-only'
    spoken.textContent = original
    const restore = () => {
      element.textContent = original
    }
    restores.push(restore)
    const state = { value: 0 }
    gsap.to(state, {
      value: count.value,
      duration: seconds(DURATIONS.cinematic),
      ease: EASE.out,
      scrollTrigger: { trigger: element, start: 'top 90%', once: true },
      onStart: () => {
        visual.textContent = formatCount(count, 0)
        element.replaceChildren(visual, spoken)
      },
      onUpdate: () => {
        visual.textContent = formatCount(count, state.value)
      },
      onComplete: restore,
    })
  }

  return () => {
    for (const restore of restores) {
      restore()
    }
  }
}
