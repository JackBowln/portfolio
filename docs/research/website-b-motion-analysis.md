# Website B — análise de movimento e interação

**Referência:** https://lusion.co/ (Lusion, estúdio de web 3D e interativa)
**Capturado:** 2026-11-25, Chromium headless, 1440×900 / 820×1180 / 390×844. Rotas exploradas: `/`, `/about`, `/projects`, `/projects/oryzo_ai`.
**Papel neste projeto:** inspiração para **como** o movimento se sente. **Não** é fonte de código, assets nem cenas 3D.

**Legenda:** **[V]** verificado por inspeção no navegador ou pela leitura do bundle publicado · **[A]** premissa ou inferência · **[N/M]** não medido nesta etapa.

---

## 1. Resumo

A Lusion é uma experiência WebGL de viewport único. O documento nunca rola de forma nativa (`html` e `body` têm `overflow: hidden`, altura do documento de 900 px). Rolagem, ponteiro e movimento da câmera são tratados por um sistema próprio de entrada que dirige uma cena Three.js. O movimento é baseado em molas e atrelado ao cursor e à câmera, não a curvas de tempo do CSS.

| Pergunta | Resposta | Verificado |
|---|---|---|
| Biblioteca de animação | Sem GSAP, ScrollTrigger, Lenis, SplitText, Splitting nem ScrollSmoother no bundle (0 ocorrências cada). Three.js está presente (152 ocorrências de `THREE`; avisos do WebGL citam `THREE.WebGLRenderer`) | [V] |
| Motor 3D | Three.js com pós-processamento (GTAO de oclusão ambiente, desfoque de movimento da câmera citado no código-fonte) | [V] (nomes), [A] (pipeline exato) |
| Movimento próprio | Uma classe `SecondOrderDynamics` (mola-amortecedor) dirige a câmera, o seguimento do cursor e o movimento de foco | [V] (classe e usos no código) |
| Modelo de rolagem | Gerenciador próprio de roda, toque e ponteiro. Um listener de `wheel` em `window` chama `preventDefault` (`passive: false`) | [V] |
| Rolagem nativa | Desativada. `html`/`body` com `overflow: hidden`, altura do documento de 900 px | [V] |
| Biblioteca de rolagem suave | Nenhuma encontrada. A rolagem é um modelo físico próprio sobre a cena 3D | [V] |
| Movimento reduzido | **Não respeitado** nas animações de CSS: as mesmas 6 animações rodam com e sem `prefers-reduced-motion: reduce` | [V] |
| Source maps | Nenhum. `…js.map` retorna `text/html` (fallback do site), não um mapa | [V] |

---

## 2. Rotas e estrutura

| Rota | Observado | Verificado |
|---|---|---|
| `/` | O hero é um canvas 3D em um painel 16:9 com moldura. Título "We create 3D visual storytelling and interactive web experiences…". Formulário de newsletter com Cloudflare Turnstile | [V] |
| `/about` | Mesma base (3 canvas), "About Us" com links de imprensa (newsroom da Porsche, Wallpaper, Opera North), endereços e contatos | [V] |
| `/projects` | Índice de projetos: cerca de 13 entradas, cada uma uma linha de texto com uma linha de categoria (ex.: "CONCEPT • WEB • DESIGN • DEVELOPMENT • 3D • ANIMATION") linkando para `/projects/<slug>` | [V] |
| `/projects/oryzo_ai` | Página de projeto com H2 e links externos (GitHub, Product Hunt, site de lançamento) | [V] |
| Cabeçalho | HOME, ABOUT US, PROJECTS, LABS (externo) | [V] |
| Rodapé | Endereço, links de redes sociais, links de e-mail `hello@` e `business@` | [V] |

**Transições de página:** as capturas mostram uma página por rota com a mesma base WebGL. Nenhuma chamada da View Transitions API foi encontrada (`startViewTransition`, 0 ocorrências). O comportamento de transição entre rotas **não** foi registrado quadro a quadro [N/M].

---

## 3. Sequência de carregamento inicial (observada)

Quadros capturados com `waitUntil: domcontentloaded` e capturas em tempos fixos (`screenshots/b-intro-300ms.png`, `screenshots/b-intro-6000ms.png`):

| Tempo | Estado | Verificado |
|---|---|---|
| ~300 ms | Tela preta. Uma barra de progresso no centro (cerca de 210×40 px, cinza). Um contador no canto inferior esquerdo lê `000` em uma fonte sans-serif neutra | [V] |
| ~6000 ms | O aglomerado de tubos 3D está visível, dentro de um painel inclinado em cerca de 25–30° que ainda se acomoda; o contador lê `…00` no canto inferior esquerdo | [V] |
| Entre os dois | O contador sobe; o painel se endireita e entra no quadro | [V] (extremos observados), [N/M] (easing e duração exatos) |

**Interpretação [A]:** um carregador de porcentagem bloqueia a revelação da cena 3D; a transformação do painel anima de inclinado para reto conforme a cena fica pronta. O gatilho exato (download de assets, compilação na GPU ou uma linha do tempo fixa) não é conhecido.

**Bloqueio:** o conteúdo da página fica escondido atrás desse carregador. É o oposto do que as regras do portfólio permitem (o LCP não pode esperar pelo movimento).

Contagens observadas durante a introdução: 11 elementos correspondentes a `[class*=loader]`, `[class*=loading]` ou `[id*=loader]` estavam exibidos. O significado não foi confirmado [N/M].

---

## 4. Inventário de movimento

Para cada animação, a tabela lista o que pôde ser verificado. Campos que não podem ser lidos de fora estão marcados **[N/M]**.

### 4.1 Hero e cena 3D

| Animação | Gatilho | Alvo | Inicial → final | Duração / easing | Observações | Verificado |
|---|---|---|---|---|---|---|
| Contador do carregador | Carregamento da página | Contador de texto, canto inferior esquerdo | 000 → 100 | [N/M] | Bloqueia a revelação | [V] |
| Endireitar o painel | Fim do carregamento | Painel 3D (canvas com moldura) | Inclinado ≈ 25–30° → 0° | [N/M] | Observado em dois quadros | [V] (extremos) |
| Aglomerado de tubos | Contínuo | Malhas do Three.js | Cilindros pretos, brancos e azuis brilhantes em um aglomerado girando | Contínuo | Pós-processado (GTAO), sombreamento matcap (`matcap.exr`, 589 KB) | [V] |
| Resposta da câmera e do aglomerado | Ponteiro e roda | Câmera, rotação dos objetos | Guiado por mola via `SecondOrderDynamics` (nomes: `focusPosMotion`, `domVideoCursorExtraRotationMotion`) | Mola; constantes no código | Resposta do cursor aparece como `easedMouseDyn` no código | [V] (nomes), [N/M] (valores) |
| Desfoque de movimento | Velocidade da câmera | Pós-processamento | `cameraMotionBlur` presente no código | — | Caro em desempenho | [V] (nome) |

### 4.2 Animações de texto

| Animação | Gatilho | Alvo | Detalhes | Verificado |
|---|---|---|---|---|
| Linha de categoria em loop (`text-animation`) | Sempre rodando (CSS) | Strings de categoria nas linhas de projeto | A linha é duplicada e cada caractere é um `<span>` repetido 4× (ex.: "O O O O r r r r y y y y…"); uma animação de CSS chamada `text-animation` roda continuamente | [V] |
| Animação da seta (`arrow-animation`) | Sempre rodando (CSS) | Glifos de seta nos links | Animação de CSS chamada `arrow-animation` roda continuamente | [V] |
| Revelação do título | Carregamento | H1 "We create 3D visual storytelling…" | Não identificada como um efeito de divisão de texto separado. Nenhuma biblioteca de SplitText presente | [N/M] |

**Spans por caractere:** a marcação duplicada, letra por letra, é um padrão de movimento em nível de caractere. É um risco para leitores de tela, a menos que o texto seja duplicado com `aria-hidden` ou que se use `aria-label`. Não verificado [N/M].

### 4.3 Hover, ponteiro e cursor

| Comportamento | Evidência | Verificado |
|---|---|---|
| Cursor personalizado | O cursor do `body` é `auto`. Nenhum `cursor: none` no bundle | [V] |
| Interação 3D dirigida pelo ponteiro | Handlers de `pointermove`, `pointerup` e `pointercancel` no canvas WebGL; classe `DeviceOrientationControls` presente | [V] |
| Hover nas linhas de projeto | Não capturado na exploração. O código cita uma rotação de cursor de vídeo (`domVideoCursorExtraRotationMotion`) | [V] (nome), [N/M] (visual) |
| Botões magnéticos | Nenhum código de efeito magnético encontrado (0 ocorrências de `magnet`) | [V] |

### 4.4 Rolagem

| Comportamento | Evidência | Verificado |
|---|---|---|
| Rolagem nativa | Desativada (`overflow: hidden`, altura de 900 px) | [V] |
| Roda | Listener de `wheel` em `window` com `preventDefault` e `passive: false`; listeners de `wheel` no canvas | [V] |
| Toque | Handlers de `touchmove` e `touchend` | [V] |
| Limiares de rolagem, snap, pins | Não medidos. A rolagem é um valor virtual dentro da cena 3D | [N/M] |
| Paralaxe ligada à rolagem | Não identificada separadamente; a posição da câmera é guiada pela rolagem | [A] |

### 4.5 Movimento reduzido e acessibilidade

| Verificação | Resultado | Verificado |
|---|---|---|
| `prefers-reduced-motion: reduce` altera animações em execução | **Não.** `arrow-animation` e `text-animation` rodam nos dois modos (6 em execução no total) | [V] |
| WebGL com movimento reduzido | Não verificado [N/M]. Provavelmente inalterado | [A] |
| Foco do teclado na experiência 3D | Não testado | [N/M] |
| Conteúdo para leitor de tela | H1 e H2 presentes; o texto decorativo se repete por caractere | [V] (estrutura), [N/M] (anúncios) |

### 4.6 Mídia e carregamento

| Item | Observado | Verificado |
|---|---|---|
| Áudio | 5 arquivos `.ogg` buscados de `lusion.dev` (`generic.ogg`, `cinematic_*.ogg`, `generic_end.ogg`). Reprodução não verificada | [V] (requisições) |
| Geometria 3D | Arquivos `.buf` (`cross.buf`, `line_reel.buf`, `astronaut_helmet*.buf`) | [V] |
| Texturas | `matcap.exr` (589 KB, fetch); mapas normais em WebP (`astronaut_*_nor.webp`, 426–450 KB cada) | [V] |
| Analytics | Tag do Google `G-…` (gtag.js, 534 KB descompactado) | [V] |
| Turnstile | Widget do Cloudflare Turnstile no formulário de newsletter. Foram vistos um desafio de 2 MB e uma resposta 401 | [V] |
| Console | Avisos do WebGL: "GPU stall due to ReadPixels", "No available adapters" (GL por software), "KHR_parallel_shader_compile not supported", "Turnstile has already been rendered" | [V] |

---

## 5. Observações de desempenho

Medido 8 s após o `load` na home, viewport desktop. Os tamanhos são de corpo **descompactado** pelo Playwright, não tamanhos de transferência.

| Métrica | Home da Website B | Home da Website A | Verificado |
|---|---|---|---|
| Requisições | 118 | 13 | [V] |
| Documento | 702 KB | 65 KB | [V] |
| Scripts | 1.902 KB (`hoisted.js` 1.222 KB, `gtag` 534 KB) | 557 KB | [V] |
| Folhas de estilo | 88 KB | 89 KB | [V] |
| Imagens | 6.161 KB | 0 | [V] |
| XHR / fetch (3D, áudio, Turnstile) | 5.353 KB + 589 KB | 0 | [V] |
| Fontes | 185 KB (Aeonik e IBM Plex Mono, hospedadas pelo próprio site) | 147 KB (Google Fonts) | [V] |

**Sinais no console:** "GPU stall due to ReadPixels" indica uma leitura síncrona da GPU, um custo conhecido em pipelines WebGL.

**Não medido [N/M]:** taxa de quadros (GL por software headless; "No available adapters"), Core Web Vitals, INP, Lighthouse. Não podem ser confiáveis numa execução headless com renderização por software e precisam ser medidos em um dispositivo com GPU real.

---

## 6. Padrões que valem adotar (em princípio)

Estas são as ideias por trás da sensação da Website B, separadas da implementação:

1. **Física de mola em vez de easing fixo para movimento guiado pelo ponteiro.** Uma resposta de segunda ordem dá sensação de peso, e pode ser feita sem WebGL (ver [animation-mapping.md](../animation-mapping.md), padrão M-02).
2. **Poucos movimentos fortes e deliberados.** Cada elemento tem um único papel: o endireitamento do painel 3D, a resposta do aglomerado, a linha de categoria.
3. **A página é um palco.** Conteúdo e movimento compartilham uma composição. O equivalente no portfólio é o storyboard, não o grafo de cena.
4. **Revelações de imagem e painel com transformação, não com layout.** A revelação de inclinado para reto é uma transformação (ver padrão M-04).
5. **Tipografia em movimento como sinal secundário.** Linhas de categoria e setas em loop dão vida sem bloquear o conteúdo (padrão M-07, com controle de pausa).

## 7. Padrões a rejeitar neste projeto

| Padrão | Por que é rejeitado aqui |
|---|---|
| Rolagem nativa substituída por um gerenciador próprio de roda e toque (scrolljacking) | Proibido pelo [motion-principles §3](../design/motion-principles.md) e pelo CLAUDE.md. Prejudica a acessibilidade e o fluxo de leitura |
| Carregador bloqueante com contador de 0 a 100 | O LCP nunca pode esperar por movimento. O conteúdo precisa estar acessível sem JS |
| Ignorar `prefers-reduced-motion` | Exigido pelo WCAG 2.3.3 e pelas regras do projeto. O comportamento da Lusion é o anti-padrão |
| Cena WebGL em tela cheia como experiência principal | Sem 3D sem aprovação (a F10-T5 foi descartada). Também tem um custo grande de desempenho e bateria (ver §5) |
| Áudio ao carregar a página | Não está no storyboard; som inesperado é um problema de acessibilidade |
| Cursor personalizado (`cursor: none`) | Proibido pelo motion-principles §3. A Lusion não o usa, então não é um padrão a copiar de qualquer forma |
| Duplicação de caracteres no DOM para texto em loop sem tratamento de `aria` | Ruído para leitores de tela; use um texto visível e uma cópia decorativa com `aria-hidden`, ou um marquee de CSS com pausa |
| Biblioteca de rolagem suave (estilo Lenis) | Proibida como rolagem suave artificial |

---

## 8. Notas de implementação para o portfólio

- **Nenhum código copiado.** Só o padrão de comportamento é adotado. A ideia de `SecondOrderDynamics` é reimplementada a partir de princípios básicos, se aprovada (ver plano, §4).
- **Nenhum asset copiado.** `matcap.exr`, a geometria `.buf`, o áudio e as texturas pertencem à Lusion.
- **O GSAP continua sendo o motor de movimento** do portfólio, como o storyboard aprovado especifica. A stack da Lusion não é motivo para adicionar outra biblioteca.
- **Bibliotecas:** o Three.js é o único motor confirmado por evidência. Nada mais no bundle da Lusion é confirmado como biblioteca. Qualquer outra coisa (por exemplo, o código próprio de mola) é inferida a partir dos nomes de classe e de uso, não de uma lista de pacotes.

---

## 9. Limitações

- WebGL headless com renderização por software. Não há dados reais de taxa de quadros, tempo de GPU nem INP.
- Só a home, a página sobre, o índice de projetos e uma página de projeto foram explorados. Outras páginas de projeto podem usar movimento diferente.
- O tempo do carregador e a duração da revelação de inclinação foram lidos de dois quadros, não de um rastro completo. Valores exatos **não** são afirmados.
- Os efeitos de hover nas linhas de projeto e as transições entre rotas não foram registrados.
- O Turnstile e o formulário de newsletter não foram usados (sem envios de teste).
- Não há source maps disponíveis; nomes do bundle minificado são usados apenas como evidência.
- O teste de movimento reduzido cobriu só as animações de CSS. O comportamento da cena WebGL sob movimento reduzido não foi verificado.

---

## Capturas de tela

| Arquivo | O que mostra |
|---|---|
| [screenshots/b-desktop-fold.png](screenshots/b-desktop-fold.png) | Home em 1440 × 900: o aglomerado de tubos 3D no painel com moldura |
| [screenshots/b-tablet-fold.png](screenshots/b-tablet-fold.png) | Home em 820 × 1180 |
| [screenshots/b-mobile-fold.png](screenshots/b-mobile-fold.png) | Home em 390 × 844 |
| [screenshots/b-intro-300ms.png](screenshots/b-intro-300ms.png) | Carregador em ~300 ms: barra de progresso e contador sobre fundo preto |
| [screenshots/b-intro-6000ms.png](screenshots/b-intro-6000ms.png) | Painel inclinado com o aglomerado 3D, contador ainda perto do fim |
