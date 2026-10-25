# Direção visual — proposta para aprovação (F01-T1)

**Status:** direção escolhida em 2026-10-25 (seção 9): par tipográfico A com a paleta B. Os tokens finais são definidos na F01-T2. Decisão técnica em [ADR-0010](../architecture/adr/0010-design-system.md); a skill `/frontend-design` aplica estas regras.

## 1. Princípios

1. **Editorial antes de decorativo.** Tipografia, ritmo e espaço em branco criam a sofisticação; efeitos são tempero.
2. **Conteúdo real dita o layout.** Nada de lorem ipsum em telas de aprovação; placeholders ficam marcados como `[PLACEHOLDER]`.
3. **Contraste e clareza.** Hierarquia evidente em 3 segundos: quem é, o que faz, prova disso e como falar com você.
4. **Restrição.** Um acento de cor, duas famílias tipográficas (mais a mono) e uma linguagem de motion.
5. **Leitura em primeiro lugar no blog** (RX-04): o layout de leitura é calmo, previsível e rápido.

## 2. Personalidade

Preciso · confiante · curioso · artesanal · contemporâneo. Evitar: "template de agência", gradientes genéricos, glassmorphism gratuito, mockups 3D de celular.

## 3. Tipografia (candidatos com licença OFL; confirmar na F01-T1)

| Par | Display | Texto / UI | Código | Caráter |
|---|---|---|---|---|
| A | Fraunces (variável: `opsz`, `SOFT`, `WONK`) | Inter (variável) | JetBrains Mono | Editorial clássico com personalidade, ótimo em títulos grandes |
| B | Instrument Serif | Instrument Sans (variável) | Geist Mono | Elegante e contemporâneo, display condensado |
| C | Space Grotesk (variável) | IBM Plex Sans | IBM Plex Mono | Técnico e geométrico, menos editorial |

**Licenças e peso dos pares prototipados** (conferidos na F01-T1, 2026-10-25; o par C não foi prototipado, por escolha do owner):

| Fonte | Licença | Pacote na styleguide | Subset latin (WOFF2) |
|---|---|---|---|
| Fraunces | OFL-1.1 | `@fontsource-variable/fraunces` 5.3.0 | 118,2 KB com todos os eixos · 65,7 KB (`opsz` + `wght`) · 35,8 KB (`wght`) |
| Inter | OFL-1.1 | `@fontsource-variable/inter` 5.3.0 | 47,1 KB (`wght`) |
| JetBrains Mono | OFL-1.1 | `@fontsource-variable/jetbrains-mono` 5.3.0 | 39,5 KB (`wght`) |
| Instrument Serif | OFL-1.1 | `@fontsource/instrument-serif` 5.3.0 | 20,5 KB (400; itálico em arquivo à parte) |
| Instrument Sans | OFL-1.1 | `@fontsource-variable/instrument-sans` 5.3.0 | 29,4 KB (`wght`) |
| Geist Mono | OFL-1.1 | `@fontsource-variable/geist-mono` 5.3.0 | 22,6 KB (`wght`) |

Preload da primeira tela (teto: 2 arquivos e 120 KB): o par A soma 112,8 KB com a Fraunces em `opsz` + `wght` (perto do teto) e 165,3 KB com todos os eixos (acima); o par B soma 49,9 KB.

**Regras:**
- **Arquivos:** WOFF2 self-hosted via `@nuxt/fonts`; no máximo **2 arquivos com preload** (display e texto, subset `latin`). O `latin-ext` carrega via `unicode-range` só quando necessário (por exemplo, "œ" em francês).
- **Escala fluida** com `clamp()`, de −1 (legendas) a 7 (hero). Exemplo de alvo para o corpo: 18–20 px em telas grandes, 17 px no mobile; `line-height` de 1,6 a 1,7.
- **Medida de leitura:** 60–75 caracteres (`max-width: 68ch`).
- **Detalhes:** números tabulares em dados e estatísticas (`font-variant-numeric: tabular-nums`); `text-wrap: balance` em títulos e `pretty` em parágrafos.

## 4. Cor (OKLCH; valores finais na F01-T2)

| Token | Claro (rascunho) | Escuro (rascunho) | Uso |
|---|---|---|---|
| `bg` | papel quente, quase branco | tinta profunda, quase preto | Fundo |
| `surface` | 1 passo acima do `bg` | 1 passo acima do `bg` | Cards, blocos de código |
| `text` | tinta | papel | Texto principal (≥ 7:1 desejável) |
| `text-muted` | cinza quente | cinza claro | Metadados (≥ 4,5:1) |
| `border` | hairline | hairline | Divisores (≥ 3:1 quando informativo) |
| `accent` | um único acento vivo (ex.: vermelhão ou azul elétrico) | versão ajustada | Links, CTA, foco |
| `focus` | derivado do acento | derivado do acento | Anel de foco (≥ 3:1 contra o fundo) |

Todo par texto/fundo passa pelo script de contraste da F01-T2. O tema padrão (claro, escuro ou do sistema) depende da Q-03.

## 5. Layout e grid

- **Grid:** 12 colunas no desktop (≥ 1024 px), 8 no tablet, 4 no mobile; gutter fluido; container máximo de 1440 px, com largura de leitura de 68ch.
- **Composições editoriais:** assimetria controlada, títulos que invadem colunas, legendas na margem, números grandes, linhas finas (hairlines) como estrutura.
- **Ritmo vertical:** espaçamentos de seção fluidos (`clamp(4rem, 10vw, 10rem)`).
- **Container queries** para cards e blocos que aparecem em larguras diferentes.

## 6. Inventário de componentes (público)

| Grupo | Componentes |
|---|---|
| Estrutura | Header, navegação, menu mobile (dialog acessível), seletor de idioma, footer, skip link, breadcrumbs |
| Primitivos | Botão, link, tag, ícone (SVG inline), divisor, badge, campo de formulário, mensagem de status |
| Home | Hero, seção narrativa (storytelling), destaque de projetos, últimos artigos, CTA |
| Projetos | Card de projeto, cabeçalho de estudo de caso, highlights (resultados verificáveis), galeria, links GitHub/demo |
| Blog | Card de artigo, cabeçalho do artigo (data, tempo de leitura, temas), sumário (TOC), paginação, artigos relacionados |
| Conteúdo | Parágrafo, títulos, listas, citação, callout, bloco de código (com botão copiar), figura, galeria, vídeo com legendas, embed com facade, tabela |
| Estados | Vazio, carregando (skeleton sem CLS), erro, 404/500 |

## 7. Responsividade

- Mobile-first, testado em 360, 390, 768, 1024, 1280, 1440 e 1920 px.
- Alvos de toque de 44×44 px (o mínimo da WCAG 2.2 AA é 24×24); hover nunca é a única forma de acessar informação.
- Imagens com `sizes` corretos por breakpoint; variante de recorte com ponto de foco.
- Sem rolagem horizontal; zoom de 200% e reflow a 320 px funcionando (WCAG 1.4.10).

## 8. Checklist de aprovação da F01-T1

- [x] Moodboard ou referências recebidas (Q-02).
- [x] Duas variações (par tipográfico + paleta) no styleguide de dev, com conteúdo real ou placeholders marcados.
- [x] Relatório de contraste de todos os pares de tokens (seção "Cores e contraste" da styleguide).
- [x] Licenças das fontes confirmadas e registradas (§3).
- [x] Tema padrão definido (Q-03).
- [x] Sua escolha registrada abaixo.

## 9. Decisões registradas

| Item | Escolha | Data |
|---|---|---|
| Par tipográfico | **A**: Fraunces (display), Inter (texto e UI) e JetBrains Mono (código e rótulos), escolhido pelo owner. Para caber no preload de 120 KB, a F01-T3 deve carregar a Fraunces só com `opsz` + `wght` (112,8 KB com a Inter) | 2026-10-25 |
| Forma | Cantos retos, que acompanharam a tipografia A na styleguide; revisável na F01-T2 | 2026-10-25 |
| Paleta e acento | **B, "Noite e rosa"**: azul-noite profundo, papel quente e um acento rosa; todos os pares passam em AA nos dois temas. Escolhida pelo Claude Code por delegação do owner, com base nas referências (abaixo); revisável pelo owner | 2026-10-25 |
| Tema padrão | Claro e escuro; o padrão segue `prefers-color-scheme`, com troca manual guardada em `localStorage` (Q-03) | 2026-10-25 |
| Referências visuais | [ingrassiadaniel.it](https://ingrassiadaniel.it/), [emotion-agency.com](https://emotion-agency.com/), [junkbranding.com](https://www.junkbranding.com/) (Q-02) | 2026-10-25 |

### Leitura das referências (F01-T1)

- **Adotado nas duas variações:** título display muito grande (passo 7 fluido com `vw`), rótulos pequenos em caixa-alta com tracking de 0,08–0,12em na fonte mono (a mono como voz de interface), hairlines como estrutura, base quase preta ou quase branca e um único acento vivo.
- **Por variação:** a paleta A parte do neutro claro com amarelo do ingrassiadaniel.it; a paleta B parte do azul-noite com rosa do junkbranding.com, que também usa a Instrument Serif. A tipografia A tem cantos retos e a B usa pílulas em botões e tags.
- **Deixado de fora** (§2): o vidro e os gradientes do emotion-agency.com. Motion e WebGL ficam para a F10, com storyboard.
- Os valores de cor são próprios, em OKLCH, e não cópias dos hex das referências.
- **Por que a paleta B:** é a mais próxima do conjunto, porque o junkbranding.com é escuro com rosa e o emotion-agency.com também parte de uma base quase preta (só o ingrassiadaniel.it é claro). O rosa funciona como texto, link, foco e preenchimento nos dois temas (os 22 pares passam em AA), enquanto o amarelo da A só pode preencher no tema claro. E ela segue o rascunho do §4: papel quente e tinta profunda.
