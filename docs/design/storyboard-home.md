# Storyboard da home e das transições (F10-T1)

Template: [motion-principles §6](motion-principles.md#6-template-de-storyboard-f10-t1). Decisões técnicas: [ADR-0011](../architecture/adr/0011-motion.md). Tokens: [motion-principles §2](motion-principles.md#2-tokens) (os mesmos de `shared/design/tokens.ts`).

**Estado:** **aprovado pelo owner em 04/11/2026** (§13).

## 1. Princípios aplicados a esta home

- **O conteúdo vem primeiro.**
  - A home é editorial: abertura, seções de texto, projetos, artigos e chamada final (blocos da F08-T2).
  - O movimento serve à hierarquia (título → apoio → ação) e à continuidade (card → estudo de caso). Nenhum efeito sem propósito (motion-principles §1).
- **O LCP nunca espera.**
  - O elemento LCP medido é o título da abertura (`h1`), e ele **nunca começa oculto**.
  - Anima-se o que está ao redor dele: sobretítulo, hairline, subtítulo, botão.
- **A home não hidrata o conteúdo** (`HomeContent` com `hydrate-never`, F08-T2).
  - O motion não depende da hidratação. Uma ilha pequena só no cliente (`MotionDirector`, F10-T2) encontra os alvos por atributos `data-motion="…"` e carrega o GSAP por `import()` em `requestIdleCallback`, depois do LCP.
  - Sem a ilha (sem JS, movimento reduzido, falha), a página é exatamente a de hoje.
- **Estados ocultos só sob `html.motion-ok`.**
  - Um script inline mínimo (com hash na CSP) põe a classe quando há JS e movimento permitido.
  - Se o motion não iniciar em 3 s, a classe sai e tudo aparece.
- **Movimento reduzido:** `prefers-reduced-motion: reduce` **ou** o botão "Reduzir movimento" do site (decisão 4).
  - Nesse caso, o GSAP **não é baixado**.
  - Sobram só transições CSS de opacidade de até `--dur-fast` (200 ms), ou nenhuma.
- **Sem scrolljacking, sem smooth scroll, sem loops automáticos acima de 5 s, sem cursor customizado.**

## 2. Abertura (seção 1)

| Campo | Descrição |
|---|---|
| Intenção | Apresentar quem é e o que faz, de imediato; o olhar vai do título para o botão |
| Conteúdo | Sobretítulo, título (o nome quando vazio), subtítulo e botão, dos blocos `home.hero` (texto real do owner ou `[PLACEHOLDER]`) |
| Gatilho | Load, depois do LCP (ilha ociosa) |
| Timeline | 1. **Hairline** (SVG de 1 px sob o sobretítulo, decisão 2): `stroke-dashoffset` 100% → 0, `--dur-cinematic` (800 ms), `--ease-emphasis`, em CSS, sem plugin.<br>2. **Sobretítulo:** `opacity` 0 → 1 e `y` 8 px → 0 (`--distance-sm`), `--dur-base`, `--ease-out`, junto com a hairline.<br>3. **Título:** visível desde o primeiro frame. Depois do LCP, o SplitText em **linhas** dá um realce leve: cada linha vai de `opacity` 0,85 → 1, stagger 60 ms, `--dur-slow`. **Sem** deslocar nem esconder.<br>4. **Subtítulo:** `opacity` 0 → 1 e `y` 24 px → 0 (`--distance-md`), `--dur-slow`, `--ease-out`, +120 ms.<br>5. **Botão:** `opacity` 0 → 1 e `y` 8 px → 0, `--dur-base`, +200 ms |
| Desktop | A timeline inteira, que termina em ~1,1 s |
| Mobile | Hairline, sobretítulo, subtítulo e botão só com fade (sem `y`); título sem split |
| Movimento reduzido | Hairline já desenhada; tudo visível; nenhum deslocamento. No máximo um fade CSS de 200 ms no subtítulo e no botão |
| Sem JS | Tudo visível e estático, hairline desenhada (estado final em CSS) |
| Performance | Hairline em CSS (0 KB de JS); SplitText só no desktop. Nenhuma long task acima de 50 ms; CLS 0, porque só `opacity` e `transform` mudam |
| Acessibilidade | Foco nunca atrás de elemento animado (o botão é focável desde o início, visível sob `motion-ok` em até 200 ms); o SplitText com `aria` lê o título como frase única e é revertido ao terminar |

## 3. Seções de texto (seção 2): storytelling (decisão 3)

| Campo | Descrição |
|---|---|
| Intenção | Contar a trajetória em etapas, uma ideia por vez |
| Conteúdo | Até 6 seções `home.sections` (título + texto) |
| Gatilho | Progresso de scroll (ScrollTrigger) |
| Timeline | **Com 3 ou mais seções, a partir de `md`:**<br>• o bloco fica fixado (`pin`) por ~100% da altura da viewport por etapa;<br>• o título da etapa atual fica à esquerda (5 colunas) e o texto à direita (7 colunas);<br>• a cada etapa, o texto anterior sai (`opacity` 1 → 0, `y` 0 → −24 px) e o próximo entra (`opacity` 0 → 1, `y` 24 → 0), com `scrub: true` (sem duração própria, segue o scroll);<br>• um indicador de progresso (hairline vertical de 1 px) acompanha `scaleY` 0 → 1.<br>**Com menos de 3 seções:** reveal simples por seção (abaixo) |
| Desktop | Pin + scrub como acima, com a âncora do topo da seção no topo da viewport |
| Mobile | Sem pin: etapas empilhadas, cada uma com reveal simples ao entrar (`opacity` 0 → 1, `y` 8 px → 0, `--dur-base`, uma vez) |
| Movimento reduzido | Etapas empilhadas e estáticas, todo o texto visível |
| Sem JS | Etapas empilhadas (o HTML de hoje) |
| Performance | ScrollTrigger com 1 pin; cálculos em `refresh()` depois de `document.fonts.ready`. Meta: 60 fps no desktop médio |
| Acessibilidade | O texto de **todas** as etapas está no DOM e na ordem de leitura; o pin não muda a ordem de tabulação nem esconde texto do leitor de tela (as etapas inativas usam só `opacity`, sem `aria-hidden`, para não esconder conteúdo de quem navega por teclado no meio do pin). O scroll é nativo |

## 4. Projetos em destaque (seção 3)

| Campo | Descrição |
|---|---|
| Intenção | Mostrar o trabalho com destaque visual e convidar ao estudo de caso |
| Conteúdo | Cards dos projetos em destaque (`ProjectCard`): capa, título, resumo, tecnologias |
| Gatilho | Entrada na viewport (uma vez) |
| Timeline | **Capa:** `clip-path: inset(8% 8% 8% 8%)` → `inset(0)` e `scale` 1,04 → 1, `--dur-slow`, `--ease-emphasis`.<br>**Texto do card:** `opacity` 0 → 1, `y` 24 px → 0, `--dur-base`, +80 ms.<br>Cards com stagger de 80 ms |
| Desktop | Como acima. Hover com `pointer: fine`: a capa vai de `scale` 1 → 1,02 em `--dur-instant` e o título ganha sublinhado em CSS |
| Mobile | Só fade da capa e do texto (sem `clip-path` nem `scale`); sem hover |
| Movimento reduzido | Nenhum reveal; hover só com sublinhado (instantâneo) |
| Sem JS | Cards visíveis; hover em CSS |
| Performance | `clip-path` só em 2–4 imagens por vez, com `will-change` só durante a animação; as imagens já têm `width` e `height` (CLS 0) |
| Acessibilidade | O link do card continua o mesmo elemento focável; o foco visível não é cortado pelo `clip-path` (o contorno fica no link, fora da área recortada) |

## 5. Últimos artigos (seção 4)

| Campo | Descrição |
|---|---|
| Intenção | Mostrar que o blog está vivo, sem competir com os projetos |
| Conteúdo | Os 3 últimos artigos (`BlogCard`) |
| Gatilho | Entrada na viewport (uma vez) |
| Timeline | Cada card com `opacity` 0 → 1 e `y` 8 px → 0, `--dur-base`, stagger 60 ms |
| Desktop | Como acima |
| Mobile | Igual (um padrão leve) |
| Movimento reduzido | Nenhum |
| Sem JS | Visível |
| Performance | Desprezível |
| Acessibilidade | Nada muda de ordem nem de foco |

## 6. Chamada final (seção 5)

| Campo | Descrição |
|---|---|
| Intenção | Fechar com uma ação clara: falar com o owner |
| Conteúdo | `home.closing` (título, texto, botão) |
| Gatilho | Entrada na viewport (uma vez) |
| Timeline | Título em linhas (SplitText): `y` 24 px → 0 e `opacity` 0 → 1, stagger 60 ms, `--dur-slow`, `--ease-out`. Texto e botão com fade + 8 px, +160 ms. Botão magnético só com `pointer: fine`, deslocamento ≤ 6 px, `--dur-fast` |
| Desktop | Como acima |
| Mobile | Fade simples, sem split nem magnetismo |
| Movimento reduzido | Visível, sem magnetismo |
| Sem JS | Visível |
| Performance | Um SplitText, revertido ao terminar |
| Acessibilidade | O efeito magnético não move o alvo para fora da área clicável nem atrapalha o foco; o título dividido é lido como frase única |

## 7. Microinterações (todas as rotas, CSS)

| Elemento | Desktop | Mobile | Movimento reduzido | Sem JS |
|---|---|---|---|---|
| Link (sublinhado) | `text-underline-offset` e cor, `--dur-instant` | Igual | Instantâneo | CSS |
| Botão | Cor de fundo, `--dur-instant`; ao pressionar, `scale` 0,98 | Igual | Sem `scale` | CSS |
| Foco | Anel de foco imediato (token `focus`) | Igual | Igual | Igual |
| Botão de tema e "Reduzir movimento" | Troca de estado sem animação de layout | Igual | Igual | Botões funcionam após hidratar; sem JS não aparecem |

São todas em CSS (0 KB de JS) e não dependem do GSAP.

## 8. Transições de página (View Transitions, F10-T4)

| Campo | Descrição |
|---|---|
| Intenção | Continuidade: a capa do projeto escolhida vira a imagem principal do estudo de caso |
| Conteúdo | Capa do `ProjectCard` → imagem `priority` do `CaseStudy`; nas demais navegações, a página inteira |
| Gatilho | Clique numa navegação interna (`experimental.viewTransition` do Nuxt) |
| Timeline | **Card → estudo de caso:** a capa (`view-transition-name: project-<slug>`, só no card clicado) faz morph de posição e tamanho até o hero do estudo de caso, `--dur-cinematic`, `--ease-in-out`; o resto faz crossfade em `--dur-base`.<br>**Demais rotas:** crossfade de `--dur-base`.<br>**Artigo do blog:** só crossfade, sem GSAP (RX-04) |
| Desktop | Como acima |
| Mobile | Crossfade curto (`--dur-fast`) também no card → estudo de caso (morph desligado abaixo de `md`) |
| Movimento reduzido | Navegação instantânea (`::view-transition-*` com `animation: none`) |
| Sem JS / sem suporte | Navegação normal, sem transição |
| Performance | A API é nativa (0 KB de biblioteca); a imagem do hero continua `priority` (LCP da R5 inalterado) |
| Acessibilidade | O foco vai para o conteúdo novo como hoje (o Nuxt/roteador decide); nada fica inerte durante a transição |

## 9. Estudo de caso (R5)

| Campo | Descrição |
|---|---|
| Intenção | Leitura confortável com ritmo, sem distrair do conteúdo |
| Gatilho | Entrada na viewport |
| Timeline | Imagens da galeria com o mesmo reveal de imagem da seção 4. Highlights numéricos **só quando o número é real** (dado do owner): contador de 0 até o valor em `--dur-cinematic`, uma vez |
| Mobile | Só fade |
| Movimento reduzido | Valores finais direto; sem reveals |
| Sem JS | Tudo visível, valores finais |
| Acessibilidade | O contador expõe o valor final ao leitor de tela desde o início (`aria-label` com o número final no elemento) |

## 10. Decisões (aprovadas no plano da F10-T1)

1. **3D: não.**
   - O conteúdo é editorial (texto, projetos, artigos); nenhuma cena 3D conta algo que tipografia, imagem e um traço não contem.
   - Custaria ~180 KB gz adicionais, poster, WebGL e cuidado com memória em mobile médio.
   - A **F10-T5 fica descartada**; ela pode voltar com uma ideia narrativa nova e um ADR.
2. **SVG: uma hairline que se desenha** sob o sobretítulo da abertura, em CSS (`stroke-dashoffset`), sem DrawSVG. Retoma as hairlines da direção visual (design-direction §9) e custa 0 KB de JS.
3. **Storytelling fixado com scrub** nas seções de texto, a partir de 3 seções e de `md`; abaixo disso, reveals simples.
4. **Botão "Reduzir movimento"** no rodapé, ao lado do seletor de idioma, com o mesmo padrão do botão de tema:
   - botão de dois estados com `aria-pressed`;
   - a escolha fica em `localStorage` e vence a preferência do sistema;
   - ligado, o GSAP não é baixado.

## 11. Orçamento previsto

| Item | Custo estimado (gz) | Onde |
|---|---|---|
| Ilha `MotionDirector` + `useMotion` + script inline `motion-ok` | ~2–3 KB | **JS estático da R1 e da R5** (o restante é adiado) |
| GSAP core | ~24 KB | Adiado (ocioso, depois do LCP) |
| ScrollTrigger | ~13 KB | Adiado, só na home desktop |
| SplitText | ~6 KB | Adiado, só desktop |
| Timelines próprias | ~3 KB | Adiado |
| **Total adiado** | **~46 KB** | Meta ≤ 60 KB gz (motion-principles §5) |
| Hairline, microinterações, View Transitions | 0 KB de JS | CSS e API nativa |
| 3D | 0 (não haverá) | — |

O JS estático da R1 está em 121,13 de 125 kB. A ilha cabe na folga (~3,9 kB), e a F10-T2 mede antes de qualquer afirmação. Se não couber, a ilha passa a ser carregada também por `import()` a partir do script inline, e sai do JS estático.

## 12. QA previsto (motion-principles §7)

- **Variantes:** gravação curta das quatro variantes de cada seção, em 390 px e 1440 px.
- **Movimento reduzido** (emulado e pelo botão): a aba Network não mostra o GSAP.
- **Teclado:** percurso completo da home, inclusive dentro do pin; o foco nunca atrás de um elemento animado.
- **Leitor de tela (VoiceOver):** títulos divididos lidos como frase única; texto das etapas do pin presente.
- **Performance:**
  - trace sem long task acima de 50 ms na inicialização;
  - CLS 0 e INP medido;
  - 4× de throttling de CPU no perfil mobile.
- **Lighthouse** da R1 e da R5 dentro da política, com o motion ativo.

## 13. Aprovação

| Data | Quem | Decisão |
|---|---|---|
| 2026-11-04 | Owner | Aprovado como está (resposta "go" ao relatório da F10-T1), com as decisões do §10 |
