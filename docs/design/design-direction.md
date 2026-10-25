# Direção visual — proposta para aprovação (F01-T1)

**Status:** proposta. As escolhas finais são registradas na seção 9, depois da sua aprovação no styleguide de desenvolvimento. Decisão técnica em [ADR-0010](../architecture/adr/0010-design-system.md); a skill `/frontend-design` aplica estas regras.

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

- [ ] Moodboard ou referências recebidas (Q-02).
- [ ] Duas variações (par tipográfico + paleta) no styleguide de dev, com conteúdo real ou placeholders marcados.
- [ ] Relatório de contraste de todos os pares de tokens.
- [ ] Licenças das fontes confirmadas e registradas.
- [ ] Tema padrão definido (Q-03).
- [ ] Sua escolha registrada abaixo.

## 9. Decisões registradas

| Item | Escolha | Data |
|---|---|---|
| Par tipográfico | _pendente_ | |
| Paleta e acento | _pendente_ | |
| Tema padrão | _pendente_ | |
| Referências visuais | _pendente_ | |
