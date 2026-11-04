// The home's scenes (storyboard-home §2–§6, F10-T3). Loaded by the director only when motion runs. Targets are found
// by data-motion in the static content. The LCP title is never hidden: only its lines get a slight lift in opacity
// after the load. Entrances of the opening run only when html.motion-ok is still on (the 3 s fallback did not
// show everything first); below the fold, each reveal sets its starting state as it is created, out of sight.
// Desktop (≥ md) gets the full timelines; mobile only fades; reduced motion never gets here
import { BREAKPOINTS, DISTANCES, DURATIONS } from '#shared/design/tokens'
import type { SceneContext } from './types'

// GSAP takes named eases; these are the closest to the CSS tokens (cubic-bezier needs the CustomEase plugin)
const EASE = { out: 'power3.out', emphasis: 'expo.out', inOut: 'power3.inOut' } as const
const seconds = (ms: number) => ms / 1000
const STAGGER = 0.06

export function homeScene({ gsap, ScrollTrigger, SplitText, scope, entrance }: SceneContext): undefined {
  const all = (name: string) => [...scope.querySelectorAll<HTMLElement>(`[data-motion="${name}"]`)]
  const one = (name: string) => scope.querySelector<HTMLElement>(`[data-motion="${name}"]`)
  const media = gsap.matchMedia()

  media.add({ desktop: `(min-width: ${BREAKPOINTS.md}px)`, mobile: `(max-width: ${BREAKPOINTS.md - 0.02}px)`, finePointer: '(pointer: fine)' }, (context) => {
    const { desktop, finePointer } = context.conditions as { desktop: boolean, finePointer: boolean }
    const shift = (distance: number) => (desktop ? distance : 0)

    // §2 Opening: eyebrow and hairline together, the subtitle, then the button; the title is already there
    if (entrance) {
      const opening = gsap.timeline({ defaults: { ease: EASE.out } })
      opening.fromTo(all('hero-eyebrow'), { opacity: 0, y: shift(DISTANCES.sm) }, { opacity: 1, y: 0, duration: seconds(DURATIONS.base) })
      opening.fromTo(all('hero-subtitle'), { opacity: 0, y: shift(DISTANCES.md) }, { opacity: 1, y: 0, duration: seconds(DURATIONS.slow) }, 0.12)
      opening.fromTo(all('hero-cta'), { opacity: 0, y: shift(DISTANCES.sm) }, { opacity: 1, y: 0, duration: seconds(DURATIONS.base) }, 0.2)
      const title = one('hero-title')
      if (desktop && title && SplitText) {
        SplitText.create(title, {
          type: 'lines',
          aria: 'auto',
          onSplit: self => gsap.fromTo(self.lines, { opacity: 0.85 }, { opacity: 1, duration: seconds(DURATIONS.slow), stagger: STAGGER, ease: EASE.out, onComplete: () => self.revert() }),
        })
      }
    }

    // §3 Narrative sections: pinned and scrubbed on desktop with 3 or more steps (the CSS stacks them under motion-ok)
    const story = one('story')
    const steps = all('story-step')
    if (desktop && entrance && story?.hasAttribute('data-pin') && steps.length >= 3 && ScrollTrigger) {
      const timeline = gsap.timeline({ scrollTrigger: { trigger: story, pin: true, start: 'top top', end: () => `+=${window.innerHeight * steps.length}`, scrub: true } })
      steps.slice(1).forEach((step, index) => {
        timeline.to(steps[index]!, { opacity: 0, y: -DISTANCES.md, ease: 'none' })
        timeline.fromTo(step, { opacity: 0, y: DISTANCES.md }, { opacity: 1, y: 0, ease: 'none' }, '<')
      })
      timeline.fromTo(all('story-progress'), { scaleY: 0 }, { scaleY: 1, ease: 'none', duration: timeline.duration() || 1 }, 0)
    }
    else {
      for (const step of steps) {
        gsap.from(step, { opacity: 0, y: DISTANCES.sm, duration: seconds(DURATIONS.base), ease: EASE.out, scrollTrigger: { trigger: step, start: 'top 85%', once: true } })
      }
    }

    // §4 Featured projects: the cover opens from an inset (desktop), the text follows; cards staggered
    all('project-card').forEach((card, index) => {
      const cover = card.querySelector('picture')
      const rest = [...card.children].filter(child => child !== cover)
      const timeline = gsap.timeline({ delay: index * 0.08, scrollTrigger: { trigger: card, start: 'top 85%', once: true } })
      if (cover) {
        timeline.from(cover, desktop
          ? { clipPath: 'inset(8% 8% 8% 8%)', scale: 1.04, duration: seconds(DURATIONS.slow), ease: EASE.emphasis, clearProps: 'clipPath,transform' }
          : { opacity: 0, duration: seconds(DURATIONS.base), ease: EASE.out })
      }
      timeline.from(rest, { opacity: 0, y: shift(DISTANCES.md), duration: seconds(DURATIONS.base), ease: EASE.out }, cover ? 0.08 : 0)
    })

    // §5 Latest articles: a light fade, the same on every screen
    const articles = all('article-card')
    const [firstArticle] = articles
    if (firstArticle) {
      gsap.from(articles, { opacity: 0, y: DISTANCES.sm, duration: seconds(DURATIONS.base), stagger: STAGGER, ease: EASE.out, scrollTrigger: { trigger: firstArticle, start: 'top 85%', once: true } })
    }

    // §6 Closing: the title in lines on desktop, then the text and the button; a magnetic button with a fine pointer
    const closing = one('closing')
    if (closing) {
      const title = closing.querySelector<HTMLElement>('[data-motion="closing-title"]')
      const rest = all('closing-rest')
      const timeline = gsap.timeline({ scrollTrigger: { trigger: closing, start: 'top 85%', once: true } })
      if (desktop && title && SplitText) {
        const split = SplitText.create(title, { type: 'lines', aria: 'auto' })
        timeline.from(split.lines, { opacity: 0, y: DISTANCES.md, duration: seconds(DURATIONS.slow), stagger: STAGGER, ease: EASE.out, onComplete: () => split.revert() })
      }
      else if (title) {
        timeline.from(title, { opacity: 0, duration: seconds(DURATIONS.base), ease: EASE.out })
      }
      timeline.from(rest, { opacity: 0, y: DISTANCES.sm, duration: seconds(DURATIONS.base), ease: EASE.out }, 0.16)

      const magnet = closing.querySelector<HTMLElement>('[data-magnetic]')
      if (desktop && finePointer && magnet) {
        const toX = gsap.quickTo(magnet, 'x', { duration: seconds(DURATIONS.fast), ease: EASE.out })
        const toY = gsap.quickTo(magnet, 'y', { duration: seconds(DURATIONS.fast), ease: EASE.out })
        const LIMIT = 6
        const move = (event: PointerEvent) => {
          const box = magnet.getBoundingClientRect()
          toX(Math.max(-LIMIT, Math.min(LIMIT, (event.clientX - box.left - box.width / 2) / 4)))
          toY(Math.max(-LIMIT, Math.min(LIMIT, (event.clientY - box.top - box.height / 2) / 4)))
        }
        const leave = () => {
          toX(0)
          toY(0)
        }
        magnet.addEventListener('pointermove', move)
        magnet.addEventListener('pointerleave', leave)
        return () => {
          magnet.removeEventListener('pointermove', move)
          magnet.removeEventListener('pointerleave', leave)
        }
      }
    }
    return undefined
  })
  return undefined
}
