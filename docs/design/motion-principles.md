# Princípios de motion

Decisão técnica em [ADR-0011](../architecture/adr/0011-motion.md); a skill `/motion-engineer` aplica estas regras. O storyboard da home (F10-T1) usa o template da seção 6.

## 1. Para que serve o movimento

| Propósito | Exemplo |
|---|---|
| **Narrativa** | Scroll storytelling apresentando trajetória e projetos |
| **Hierarquia** | Revelar o título antes do apoio; guiar o olhar para o CTA |
| **Continuidade** | A imagem do card vira o hero do estudo de caso (View Transition) |
| **Feedback** | Hover, foco, pressionar, enviar o formulário |

Movimento sem um desses propósitos é cortado.

## 2. Tokens

| Token | Valor | Uso |
|---|---|---|
| `--dur-instant` | 120 ms | Hover e foco |
| `--dur-fast` | 200 ms | Microinterações; teto da variante reduzida |
| `--dur-base` | 320 ms | Entradas de componentes |
| `--dur-slow` | 500 ms | Reveals de seção |
| `--dur-cinematic` | 800 ms | Hero e transições narrativas (máximo para UI) |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Entradas |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Transições entre estados |
| `--ease-emphasis` | `cubic-bezier(0.16, 1, 0.3, 1)` | Reveals dramáticos |
| `--stagger` | 40–80 ms | Listas, palavras e linhas |
| `--distance-sm` / `--distance-md` | 8 px / 24 px | Deslocamentos de entrada |

Os mesmos valores ficam exportados em `shared/design/tokens.ts` para o GSAP.

## 3. Catálogo de padrões

| Padrão | Desktop | Mobile | Movimento reduzido | Sem JS |
|---|---|---|---|---|
| Reveal de texto (SplitText em linhas) | Linhas sobem 24 px com fade, stagger de 60 ms | Fade + 8 px, sem split por palavra | Fade de 200 ms ou nenhum | Texto visível |
| Reveal de imagem | `clip-path` inset → 0 + leve scale 1.04 → 1 | Só fade | Nenhum | Imagem visível |
| Parallax | `y` até 10% da altura, scrub | Desligado | Desligado | Estático |
| Storytelling com pin + scrub | Seção fixada, etapas por scroll | Etapas empilhadas, reveal simples | Etapas empilhadas e estáticas | Etapas empilhadas |
| Contador de highlights | Só para números **reais**, 800 ms | Igual | Valor final direto | Valor final |
| Hover magnético | Só com `pointer: fine` e deslocamento ≤ 6 px | Desligado | Desligado | — |
| Transição de página | View Transition (crossfade/morph de elemento compartilhado) | Crossfade curto | Instantânea | Navegação normal |
| Sublinhado de link e foco | CSS 120 ms | Igual | Instantâneo | CSS |

**Proibido:**
- scrolljacking ou smooth scroll artificial;
- animação que esconda o elemento LCP;
- loops infinitos chamativos (movimento automático de mais de 5 s exige controle de pausa, WCAG 2.2.2);
- flashes acima de 3 por segundo (WCAG 2.3.1);
- cursores customizados que escondam o ponteiro do sistema.

## 4. Regras técnicas (resumo)

- GSAP carregado sob demanda, depois do LCP, só em rotas com motion; **nunca** no artigo do blog.
- `gsap.context()` + `revert()` no unmount; `gsap.matchMedia()` para breakpoints e movimento reduzido; `ScrollTrigger.refresh()` depois das fontes e imagens.
- Estados iniciais ocultos só sob `html.motion-ok`; fallback remove a classe se o motion não iniciar em 3 s.
- Só `transform` e `opacity` (e `clip-path` com moderação); `will-change` só durante a animação.
- Inicialização sem long tasks acima de 50 ms; INP ≤ 200 ms; CLS 0.
- SplitText com `aria` habilitado; reverter o split depois da animação quando possível.

## 5. Orçamento

| Item | Limite |
|---|---|
| JS de motion (GSAP + plugins + código próprio) | Fora do caminho crítico; medir na F10-T2 (meta ≤ 60 KB gz) |
| Three.js (só se aprovado) | Carregado por IntersectionObserver; poster como LCP; meta ≤ 180 KB gz adicionais |
| Frames | 60 fps em desktop médio; sem quedas sustentadas abaixo de 50 fps no Android médio (CPU throttling 4×) |

## 6. Template de storyboard (F10-T1)

| Campo | Descrição |
|---|---|
| Seção | Nome e ordem na página |
| Intenção | O que o visitante deve entender ou sentir |
| Conteúdo | Textos e imagens reais (ou `[PLACEHOLDER]`) |
| Gatilho | Load, entrada na viewport, progresso de scroll, hover, clique |
| Timeline | Passos com elemento, propriedade, de → para, duração, easing |
| Desktop | Variante completa |
| Mobile | Variante simplificada |
| Movimento reduzido | Estado final e transições permitidas |
| Sem JS | O que aparece |
| Performance | Custo estimado e medição prevista |
| Acessibilidade | Foco, leitores de tela, pausa, contraste durante a animação |

## 7. QA de motion (antes de aprovar uma tarefa)

- [ ] Variantes desktop, mobile, reduzida e sem JS conferidas (gravação curta ou screenshots).
- [ ] `prefers-reduced-motion` emulado: o GSAP não é baixado (aba Network).
- [ ] Teclado: o foco nunca fica atrás de um elemento animado; a ordem de tabulação se mantém.
- [ ] Leitor de tela: o texto dividido é lido como frase única.
- [ ] Performance: trace sem long tasks acima de 50 ms na inicialização; CLS 0; INP medido.
- [ ] Lighthouse da rota dentro do orçamento ([performance-budgets](../quality/performance-budgets.md)).
