# ADR-0011 — Motion: GSAP sob demanda, View Transitions e 3D condicional

- **Status:** Aceito (2026-10-25)
- **Decisores:** Owner · Claude Code
- **Relacionados:** ADR-0003, ADR-0010, [motion-principles](../../design/motion-principles.md), RX-02, RX-03, RX-05, RNF-01, RNF-02, RNF-10

## Contexto

- A home deve ser cinematográfica (scroll storytelling, microinterações, transições de página) sem sacrificar o Lighthouse 100, o INP ou a acessibilidade.
- GSAP 3.15 é gratuito sob a licença "Standard no-charge", que inclui ScrollTrigger, SplitText, Flip, DrawSVG e MorphSVG. Não é open source.
- SplitText tem suporte a `aria` e `autoSplit`.
- Three.js 0.186 é pesado.

## Decisão

1. **Bibliotecas.**
   - GSAP `~3.15` com ScrollTrigger e SplitText. Flip, DrawSVG ou MorphSVG só quando o storyboard pedir.
   - **Sem ScrollSmoother nem bibliotecas de smooth scroll**: preservam o scroll nativo, o teclado e as tecnologias assistivas.
   - A licença fica registrada; o uso num portfólio pessoal é permitido.
2. **Carregamento.**
   - `import()` dinâmico dentro de `app/composables/motion/useMotion.ts`, só no cliente.
   - Dispara depois do `onMounted` e quando o navegador estiver ocioso, após o LCP (`requestIdleCallback`, com fallback por timeout).
   - Só nas rotas que usam motion (home, estudo de caso); **nunca no artigo do blog** (RX-04).
3. **Movimento reduzido.**
   - Com `prefers-reduced-motion: reduce`, ou com o toggle "reduzir movimento" do site (em `localStorage`), **o GSAP nem é carregado**.
   - A versão reduzida usa transições CSS de opacidade de no máximo 200 ms, ou nenhuma, e preserva o estado final e toda a informação.
4. **Progressive enhancement.**
   - O conteúdo é visível sem JS.
   - Um script inline mínimo (com hash na CSP) adiciona `html.motion-ok` só se o JS estiver ativo e o movimento for permitido. Os estados iniciais ocultos existem **apenas** sob `.motion-ok`.
   - Se o motion não inicializar em 3 s, a classe é removida (fallback).
   - **O elemento LCP nunca começa oculto**: anima-se o que está ao redor dele.
5. **Ciclo de vida.**
   - `gsap.context()` com escopo no componente e `revert()` no `onBeforeUnmount`.
   - `gsap.matchMedia()` para breakpoints e preferências.
   - `ScrollTrigger.refresh()` depois de `document.fonts.ready` e do carregamento das imagens relevantes; `kill` na troca de rota.
6. **Transições de página.** View Transitions API (`experimental.viewTransition` do Nuxt) para crossfade e morph entre rotas; o GSAP fica restrito ao conteúdo de cada página. Sem suporte no navegador, a navegação é instantânea.
7. **Regras de performance.**
   - Animar só `transform` e `opacity` (`clip-path` com moderação).
   - Sem ler e escrever layout no mesmo frame.
   - `will-change` só durante a animação.
   - Inicialização sem long tasks acima de 50 ms; INP ≤ 200 ms; CLS 0.
   - Pins do ScrollTrigger só no desktop, a partir de `md`. No mobile, timelines simplificadas.
8. **SplitText.** Com `aria: 'auto'` (ou equivalente). A divisão é revertida depois da animação quando possível, e `autoSplit` + `onSplit` cuidam do redimensionamento.
9. **3D (Three.js) é condicional.** Só entra se o storyboard (F10-T1) mostrar um ganho narrativo que SVG ou CSS não alcançam. Nesse caso:
   - componente client-only com `import('three')`, iniciado por IntersectionObserver e pausado fora da tela;
   - `devicePixelRatio` limitado a 1,5–2 e `dispose()` ao desmontar;
   - **poster estático** como fallback para sem WebGL, movimento reduzido, `saveData` ou `deviceMemory < 4`.
10. **Tokens compartilhados** com o CSS em `shared/design/tokens.ts` (durações e easings) ([ADR-0010](0010-design-system.md)).

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Só CSS ou Web Animations API | Insuficiente para scroll storytelling sincronizado e SplitText; continua sendo usado em microinterações simples |
| Motion One / `@vueuse/motion` | Menos ferramentas para timelines de scroll complexas |
| ScrollSmoother / Lenis | Sequestram o scroll nativo, com risco de acessibilidade e INP |
| Three.js por padrão | Peso alto sem justificativa narrativa |

## Consequências

### Positivas
- Impacto visual sem custo no LCP, com a versão reduzida e a sem JS completas por construção.

### Negativas e custos
- Disciplina de ciclo de vida (contextos e refresh) exigida em cada componente animado.

### Riscos e mitigação
- **Motion degradar o INP em dispositivos médios:** `/performance-audit` com throttling de CPU 4× e teste em Android de gama média antes de aprovar a F10.

## Validação

- F10-T2: teste de componente com `matchMedia` mockado garante que o GSAP não é importado com movimento reduzido.
- F10-T3: Lighthouse da home com motion ativo mantém Performance dentro da tolerância; vídeo de QA do storyboard aprovado.

## Referências

- Licença GSAP: "Standard 'no charge' license" (campo `license` do pacote npm)
- WCAG 2.2: 2.2.2 (pausar, parar, ocultar) e 2.3.3 (animação por interação)
- MDN: `prefers-reduced-motion`, View Transitions API
