# Mapeamento de animação — seções do Website A × padrões do Website B

**Entradas:** [website-a-functional-analysis.md](research/website-a-functional-analysis.md) (o que o produto faz) e [website-b-motion-analysis.md](research/website-b-motion-analysis.md) (como o movimento se sente).
**Regras aplicadas:** [motion-principles.md](design/motion-principles.md), [storyboard-home.md](design/storyboard-home.md) (aprovado em 04/11/2026), CLAUDE.md, seções "Motion" e "Performance".
**Legenda:** **Existente** = já implementado no portfólio; **Novo** = proposto, precisa de aprovação; **Rejeitado** = não usado.
**Situação atual (2026-11-25):** F13-T2, T3, T4 e T6 implementados nos branches `feat/F13-*`; ver o [plano de implementação](implementation-plan.md), §8.

---

## 1. Catálogo de padrões

Cada padrão é reutilizável. As ideias do Website B são traduzidas para o sistema de movimento do portfólio (GSAP sob demanda, CSS para microinterações, gate `html.motion-ok`).

| ID | Padrão | Ideia de origem (Website B) | Implementação no portfólio | Situação |
|---|---|---|---|---|
| M-01 | **Coreografia de abertura** — linha, sobretítulo, subtítulo e CTA em sequência; o título nunca fica oculto | Entrada em etapas do hero (§4.1) | `homeScene` §2 (timeline do GSAP) | Existente (F10-T3) |
| M-02 | **Resposta de ponteiro com mola** — uma mola de segunda ordem segue o ponteiro em deslocamentos pequenos | `SecondOrderDynamics` na câmera e no cursor (§4.1, §4.3) | Helper TypeScript pequeno (sem dependência), em `app/composables/motion/spring.ts`. Aplicado ao CTA magnético. **Só ponteiro fino**, deslocamento ≤ 6 px | Implementado (F13-T6) |
| M-03 | **Narrativa fixada com scrub** | Narrativa ligada à rolagem (modelo de rolagem da Website B, rejeitado como scrolljacking; mantido só como scrub em um bloco fixado) | `homeScene` §3, agora parametrizado por nome de história | Existente (F10-T3); reutilizado para a experiência (F13-T3) |
| M-04 | **Revelação de imagem** — inset por clip-path até o total, leve escala; no mobile só fade | Revelação do painel (inclinado → reto) (§3) | `homeScene` §4 (`clipPath` + `scale`) | Existente (F10-T3) |
| M-05 | **Revelação de lista em cascata** — uma vez, `opacity` + `y` (≤ 24 px), intervalo de 40–80 ms | Entradas em cascata | `gsap.from` com ScrollTrigger `once` | Existente (F10-T3); usado também nos grupos de habilidades (F13-T4) |
| M-06 | **Contagem para números reais** — 800 ms, valor final no HTML | Animação numérica (não está na B; adicionada pelo storyboard §3, "Contador") | Cena `count` (highlights de projeto) e a faixa de números da home (F13-T2): só números simples, intervalos ficam estáticos | Existente para destaques de projeto; **implementado** para a faixa de números (F13-T2) |
| M-07 | **Marquee em loop** — uma faixa horizontal lenta de tags, pausável, cópia duplicada com `aria-hidden` | Linhas de categoria em loop (§4.2) | `@keyframes` de CSS em `transform`; pausa com hover/foco e um controle visível; `prefers-reduced-motion` a interrompe | Novo (P2), **não incluído** em F13-T4 (opcional) |
| M-08 | **Transição de rota** — crossfade com View Transitions; morph de elemento compartilhado para card → estudo de caso | Transições de página (o Website A usa `startViewTransition`; a B não tem) | `experimental.viewTransition` + `main.css` | Existente (F10-T4) |
| M-09 | **CTA magnético** — até 6 px, só com ponteiro fino | Efeito magnético (a B não tem; o storyboard mantém pequeno) | `closingScene`, agora com mola (M-02) | Existente (F10-T3), refinado (F13-T6) |
| M-10 | **Feedback de hover** — sublinhado de link e leve escala, 120 ms de CSS | Microinterações de hover | Tailwind + tokens | Existente (F10-T4) |
| M-11 | **Carregador percentual dramático** — contador de 0 a 100 bloqueando a página | Introdução da Website B (§3) | — | **Rejeitado** (bloqueia o conteúdo e o LCP) |
| M-12 | **Divisão de caracteres no hover** | Spans por letra (§4.2) | — | **Rejeitado** por enquanto (ruído para leitores de tela, custo). Reavaliar só com tratamento de `aria` |
| M-13 | **Feedback de formulário e de estado** — estado dos chips de tom, confirmação de cópia, revelação da saída | Microinterações | CSS de 120 ms + região `aria-live` com o status | Novo (P2), depende de D-02 e do texto aprovado |
| M-14 | **Hero 3D** — cena Three.js como a da Website B | §4.1, §5 | — | **Adiado / fora do escopo** (D-05): precisa de ADR e aprovação explícita. Se algum dia for aprovado, orçamento ≤ 180 KB gz, pôster como LCP |
| M-15 | **Cursor personalizado / câmera guiada pelo cursor** | §4.3 | — | **Rejeitado** (motion-principles §3) |
| M-16 | **Rolagem suave / scroll hijack** | §4.4 | — | **Rejeitado** (motion-principles §3) |
| M-17 | **Áudio** | §4.6 | — | **Rejeitado** (fora do storyboard) |

---

## 2. Seções do Website A → padrões

Cada linha é um componente do Website A (ver a análise funcional, §3), com o movimento proposto. Desktop é a versão completa; mobile segue a variante simplificada do storyboard; movimento reduzido significa que nenhum GSAP é baixado (CLAUDE.md).

| ID A | Componente (A) | Referência funcional | Animação proposta | Gatilho | Desktop | Mobile / tablet | Movimento reduzido | Sem JS | Prioridade |
|---|---|---|---|---|---|---|---|---|---|
| F1 | Hero | Sobretítulo, H1, parágrafo, CTAs | M-01 (existente) | Carregamento, depois do LCP | Timeline completa (~1,1 s) | Só fade, sem split | Visível, sem movimento | Visível | P0 (feito) |
| F2 | Cartão blueprint | Linhas decorativas; o texto "60 FPS" não é uma afirmação funcional | Cartão estático. Tilt opcional com M-02 no ponteiro fino (≤ 4 px). **Remover o texto "60 FPS"** — nada o mede | Hover (ponteiro fino) | Tilt opcional | Nenhuma | Nenhuma | Estático | P2 |
| F3 | Faixa de números | Quatro números (fornecidos pelo owner) | M-06 contagem para 800 ms, uma vez na viewport | Entrada na viewport | Contagem | Valor final | Valor final | Valor final | P1 (feito, F13-T2) |
| F4 | Experiência | Seis funções com descrições | M-03 narrativa fixada com scrub (desktop, ≥ 3 funções). Cada função é um passo | Progresso da rolagem | Pin + scrub | Empilhada, revelação M-05 | Empilhada, estática | Empilhada | P1 (feito, F13-T3) |
| F5 | Projetos | Cards com links e tags | M-04 revelação da capa + M-05 do texto (`ProjectCard` existente) | Viewport, uma vez | Revelação por clip-path | Só fade | Estático | Visível | P0 (feito) |
| F6 | Habilidades | Listas agrupadas | M-05 para os grupos (feito, F13-T4). **Opcional** M-07 para as tags, pausado por padrão no foco/hover; sem marquee para conteúdo de leitor de tela | Viewport | Revelação da lista | Só revelação da lista, sem marquee | Lista estática, sem marquee | Lista estática | P2 (marquee não feito) |
| F7 | Gerador de mensagem de contato | Formulário, chips de tom, saída, cópia | M-13 só de feedback: estado do chip em 120 ms, revelação da saída com M-05 (≤ 8 px), confirmação de cópia por `aria-live` | Ação do usuário | Feedback + revelação | Só feedback | Instantâneo | Formulário nativo | P2 (depende de D-02) |
| F8 | Listagem do blog | Cards de artigo | M-05 leve fade (existente) | Viewport, uma vez | Fade + cascata de 60 ms | Fade | Estático | Visível | P0 (feito) |
| F9 | Página de artigo | Texto longo | **Nenhum** (storyboard: sem movimento em artigos) | — | — | — | — | Visível | P0 |
| F10 | Contato | Links de e-mail, telefone, LinkedIn, GitHub. O formulário real está em `/contato` (existente) | M-09 CTA magnético na ação principal de contato (existente) | Ponteiro, só fino | Magnético ≤ 6 px | Nenhum | Nenhum | Links | P0 (feito, refinado em F13-T6) |
| F11 | Download do CV | Link para PDF | M-10 sublinhado no hover (CSS) | Hover/foco | CSS | Igual | Instantâneo | Link | P0 (feito, F13-T5) |
| F12 | 404 | "Page not found" | Nenhum | — | — | — | — | Visível | P0 |
| — | Trocas de rota | View Transitions (A) | M-08 crossfade; morph do card para o estudo de caso (existente) | Navegação | Crossfade de 200–320 ms | Crossfade | Instantâneo | Navegação normal | P0 (feito) |

---

## 3. Prioridade e fases

| Prioridade | Significado | Itens |
|---|---|---|
| **P0** | Já existe no portfólio ou é exigido para paridade | F1, F5, F8, F9, F10, F11, F12, trocas de rota |
| **P1** | Acrescenta valor real à paridade funcional do A | F3 contagem (feito), F4 narrativa da experiência (feito) |
| **P2** | Acabamento; só depois que P0/P1 passarem nos orçamentos | F2 tilt, F6 marquee (não feito), F7 feedback, o helper de mola (feito para o CTA) |
| **Adiado** | Precisa de nova decisão | M-14 hero 3D |
| **Rejeitado** | Conflita com as regras | M-11, M-12, M-15, M-16, M-17 |

---

## 4. Implementação técnica por padrão

| Padrão | Abordagem técnica | Dependências | Limpeza | Regra de desempenho |
|---|---|---|---|---|
| M-01, M-03, M-04, M-05, M-09 | `homeScene` / `gsap.context` existentes; `matchMedia` para breakpoints e movimento reduzido | GSAP (já existente, sob demanda) | `ctx.revert()` no unmount e quando o movimento é desligado | Só `transform`, `opacity` e `clip-path` com moderação |
| M-02 | Helper `spring.ts`: mola de segunda ordem (rigidez 280, amortecimento 23,3, ζ ≈ 0,7), funções puras; o ticker do GSAP roda só enquanto a mola se move | Nenhuma | O ticker é removido quando a mola assenta ou a cena reverte | Só com `(pointer: fine)` e movimento permitido; sem trabalho quando parado |
| M-06 | Cena `count`: lê o texto final do DOM, anima um inteiro com `gsap.to` e o escreve de volta; com movimento reduzido mostra o valor final de imediato. Faixa de números com `countableStat`, que recusa intervalos | GSAP | Restauração do texto original ao final e ao reverter | Um tween por número; sem leitura de layout dentro do tween |
| M-07 | `@keyframes` puro de CSS em `transform: translateX`; `animation-play-state: paused` no hover/foco e por um controle visível; a cópia duplicada tem `aria-hidden="true"` | Nenhuma | Nenhuma (CSS) | Compositor; sem JS |
| M-08 | `experimental.viewTransition` (já ligado) | Nenhuma | — | Respeitar `prefers-reduced-motion` em `main.css` |
| M-13 | Transições de CSS; uma única região `aria-live="polite"` para "copiado" | Nenhuma | — | Sem JS quando o gerador não depende de servidor |

**Lugar no código:** cenas novas ficam em `app/composables/motion/scenes/`; os alvos são encontrados por `data-motion`; o director não muda. Padrões só de CSS (M-07, M-10) não importam o GSAP.

---

## 5. Regras de responsividade e movimento reduzido (resumo)

| Breakpoint / preferência | Regra |
|---|---|
| ≥ `md` (768 px), ponteiro fino | Timelines completas, pins, efeitos magnético e de mola |
| < `md` | Só fades; sem pins; sem clip-path no mobile (igual ao storyboard) |
| `prefers-reduced-motion: reduce` ou o botão "Reduzir movimento" do site | O GSAP não é baixado; o movimento de CSS some (transições de opacidade de no máximo 200 ms); marquees param; contagens mostram o valor final |
| Sem JavaScript | Todo o conteúdo visível no HTML estático; a linha do hero já desenhada |

**A falha da Website B em respeitar o movimento reduzido** (verificada, ver a análise da B, §4.5) é o motivo do teste explícito no plano (AC-M3).

---

## 6. Requisitos de acessibilidade por padrão

| Padrão | Requisito |
|---|---|
| M-01, M-03 | A narrativa fixada mantém todo o texto na ordem do DOM; passos inativos não são `aria-hidden`; o foco nunca fica escondido atrás de um elemento fixado |
| M-02 | Só em ponteiros finos; nunca tira controles focáveis do alcance; o movimento reduzido o desliga |
| M-06 | O valor final está no HTML; o anúncio é o texto final, não os quadros intermediários |
| M-07 | Controle de pausa acessível pelo teclado; `aria-hidden` na cópia duplicada; para com movimento reduzido; nunca se move por mais de 5 s sem pausa (WCAG 2.2.2) |
| M-09 | O link continua sendo o elemento focável; o ímã não muda a área de clique |
| M-13 | Mensagens de status por `aria-live`; nenhum movimento que transmita informação sozinho |
| Todos | Sem flashes acima de 3 por segundo (WCAG 2.3.1); indicador de foco sempre visível (WCAG 2.4.7) |

---

## 7. Estimativa de custo de desempenho

| Item | Custo estimado | Base |
|---|---|---|
| GSAP e plugins | Já carregados depois do LCP em rotas com movimento; não na página de artigo | Regra existente (motion-principles §5) |
| Helper de mola (M-02) | < 1 KB gz; trabalho zero quando parado | Escrito à mão; sem dependência |
| Contagens (M-06) | Um tween por número (4 na home) | Dentro do GSAP já carregado |
| Marquee (M-07), não feito | 0 KB de JS; transform do compositor | Só CSS |
| 3D (M-14) | Não planejado. Se aprovado, ≤ 180 KB gz adicionais, carregado por IntersectionObserver | motion-principles §5 |

**Medição obrigatória** antes que qualquer item P1/P2 seja publicado: Lighthouse da rota afetada, rastro sem tarefa acima de 50 ms na inicialização e CLS = 0. Ver os critérios de aceitação do plano de implementação.

---

## 8. Decisões de que este mapeamento depende

| ID | Pergunta | Recomendação | Resposta do owner |
|---|---|---|---|
| D-01 | Trocar a "Experiência" do storyboard da home pelo bloco de narrativa fixada (F4)? | Sim | **Sim** (F13-T3) |
| D-02 | Construir o gerador de mensagem de contato? Se sim, como template no cliente ou com Workers AI? | Template no cliente, sem custo de IA | **Sim, no cliente**; o texto do template precisa de aprovação (F13-T7) |
| D-03 | Aceitar a faixa de números com os quatro valores fornecidos pelo owner? | Sim, se o owner confirmar cada um | **Sim**, com as fontes do currículo (F13-T2; ver o plano, §8.2) |
| D-04 | Manter o 3D (M-14) fora do escopo? | Sim | **Sim** (D-05) |
