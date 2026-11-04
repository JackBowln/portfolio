// The only place that imports GSAP (CLAUDE.md boundaries: gsap only by dynamic import under composables/motion).
// Its chunks are fetched when useMotion starts, never on a page that does not ask for motion
export type MotionPlugin = 'ScrollTrigger' | 'SplitText'

export async function loadGsap(plugins: readonly MotionPlugin[]) {
  const [{ gsap }, scrollTrigger, splitText] = await Promise.all([
    import('gsap'),
    plugins.includes('ScrollTrigger') ? import('gsap/ScrollTrigger').then(module => module.ScrollTrigger) : undefined,
    plugins.includes('SplitText') ? import('gsap/SplitText').then(module => module.SplitText) : undefined,
  ])
  gsap.registerPlugin(...[scrollTrigger, splitText].filter(plugin => plugin !== undefined))
  return { gsap, ScrollTrigger: scrollTrigger, SplitText: splitText }
}

export type MotionApi = Awaited<ReturnType<typeof loadGsap>>
