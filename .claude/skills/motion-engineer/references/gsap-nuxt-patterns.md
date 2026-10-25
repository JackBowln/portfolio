# Padrões GSAP no Nuxt 4 (referência)

> Padrões de referência para GSAP `~3.15`. **Confira a API na versão instalada** (`node_modules/gsap/types`) antes de copiar. Os nomes de arquivo seguem o overview §3.

## 1. Carregador único (só cliente, sob demanda)

```ts
// app/composables/motion/gsap.client.ts
let loading: Promise<typeof import('./gsap-bundle')> | null = null

export function loadGsap() {
  loading ??= import('./gsap-bundle')
  return loading
}
```

```ts
// app/composables/motion/gsap-bundle.ts — único arquivo que importa gsap
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)
export { gsap, ScrollTrigger, SplitText }
```

## 2. Gate de movimento e timing

```ts
// app/composables/motion/useMotion.ts
export function motionAllowed(): boolean {
  if (import.meta.server) return false
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const userReduced = safeLocalStorageGet('reduce-motion') === '1' // toggle do site
  return !reduced && !userReduced
}

function whenIdleAfterLoad(cb: () => void) {
  const run = () => ('requestIdleCallback' in window
    ? requestIdleCallback(cb, { timeout: 2000 })
    : setTimeout(cb, 200))
  if (document.readyState === 'complete') run()
  else window.addEventListener('load', run, { once: true })
}

export function useMotion(
  root: Ref<HTMLElement | null>,
  setup: (api: Awaited<ReturnType<typeof loadGsap>>) => void,
) {
  let ctx: { revert: () => void } | undefined
  onMounted(() => {
    if (!motionAllowed() || !root.value) return
    whenIdleAfterLoad(async () => {
      const api = await loadGsap()
      await document.fonts.ready
      ctx = api.gsap.context(() => setup(api), root.value!)
      api.ScrollTrigger.refresh()
    })
  })
  onBeforeUnmount(() => ctx?.revert())
}
```

## 3. Breakpoints e preferências dentro do contexto

```ts
useMotion(sectionRef, ({ gsap }) => {
  const mm = gsap.matchMedia()
  mm.add(
    { isDesktop: '(min-width: 768px)', isMobile: '(max-width: 767px)' },
    (context) => {
      const { isDesktop } = context.conditions as { isDesktop: boolean }
      const tl = gsap.timeline({
        scrollTrigger: isDesktop
          ? { trigger: sectionRef.value, start: 'top top', end: '+=150%', scrub: true, pin: true }
          : { trigger: sectionRef.value, start: 'top 80%' },
      })
      tl.from('[data-step]', { autoAlpha: 0, y: isDesktop ? 24 : 8, stagger: 0.06, ease: 'power3.out' })
    },
  )
})
```

O `matchMedia` reverte sozinho ao trocar de breakpoint. O `gsap.context` do `useMotion` reverte tudo no unmount.

## 4. SplitText acessível

```ts
useMotion(titleRef, ({ gsap, SplitText }) => {
  SplitText.create(titleRef.value!, {
    type: 'lines',
    mask: 'lines',      // revela com máscara
    aria: 'auto',       // leitor de tela lê a frase inteira
    autoSplit: true,    // refaz o split no resize/troca de fonte
    onSplit: self => gsap.from(self.lines, { yPercent: 100, duration: 0.8, stagger: 0.06, ease: 'expo.out' }),
  })
})
```

## 5. Estado inicial sem esconder conteúdo sem JS

```css
/* app/assets/css/main.css */
.motion-ok [data-reveal] { opacity: 0; transform: translateY(var(--distance-md)); }
```

O script inline no `<head>` (com hash na CSP) adiciona `motion-ok` só com JS ativo e movimento permitido, e a remove se o motion não iniciar em 3 s. **Nunca aplique `data-reveal` ao elemento LCP.**

## 6. Transições entre páginas

- `nuxt.config.ts`: `experimental: { viewTransition: true }`.
- Elemento compartilhado: o mesmo `view-transition-name` (por exemplo `project-hero-<id>`) na imagem do card e no hero do estudo de caso, **único por página**.
- Com movimento reduzido: `@media (prefers-reduced-motion: reduce) { ::view-transition-group(*) { animation: none } }`.

## 7. Armadilhas

- Criar ScrollTriggers antes das fontes e imagens carregarem → posições erradas (chame `refresh`).
- Esquecer o `revert` na troca de rota → triggers fantasmas e vazamento de memória.
- Animar `filter: blur()` em áreas grandes → jank no mobile.
- Ler layout (`getBoundingClientRect`) dentro de `onUpdate` → layout thrashing.
- Importar `gsap` em componente público de forma estática → GSAP no bundle inicial (o lint bloqueia).
