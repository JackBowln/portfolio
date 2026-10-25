# Acessibilidade — WCAG 2.2 AA

Meta: **WCAG 2.2 nível AA** no site público **e** no admin, com Lighthouse Accessibility 100 e zero violações axe sérias ou críticas. Nota automática não prova conformidade: a checklist manual abaixo é obrigatória para templates novos.

## 1. Automatizado (CI)

- `@axe-core/playwright` com tags `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`, em todos os templates × (pt-BR, de) × (claro, escuro) × movimento reduzido.
- Lighthouse Accessibility = 100 nas rotas-chave.
- Testes de teclado no Playwright para: menu mobile, seletor de idioma, formulário de contato, login do admin, editor (inserir imagem e link) e publicação.

## 2. Checklist manual por template

### Estrutura e semântica
- [ ] Landmarks: `header`, `nav` (com rótulo), `main` (único), `footer`; skip link para o `main` como primeiro foco.
- [ ] Um `h1` por página; níveis sem saltos (o editor limita os artigos a H2–H4).
- [ ] Listas como listas; tabelas com `th`/`scope` e `caption` quando necessário.
- [ ] `<html lang>` correto; trechos em outro idioma com `lang` (por exemplo, nomes de idiomas no seletor).

### Teclado e foco
- [ ] Tudo operável por teclado, em ordem lógica e sem armadilhas.
- [ ] Foco visível com contraste ≥ 3:1 (2.4.7, 2.4.11); o header fixo não cobre o elemento focado (`scroll-padding-top`).
- [ ] Menu mobile como dialog: foco preso enquanto aberto, `Esc` fecha e o foco volta ao botão.
- [ ] Arrastar (drag handle do editor) tem alternativa por teclado ou botão (2.5.7).

### Percepção
- [ ] Contraste: texto ≥ 4,5:1 (grande ≥ 3:1); componentes e ícones informativos ≥ 3:1; nos dois temas.
- [ ] Zoom de 200% sem perda; reflow a 320 px sem rolagem horizontal (1.4.10); espaçamento de texto ajustável (1.4.12).
- [ ] Informação nunca só por cor.
- [ ] Imagens informativas com `alt` significativo no idioma da página; decorativas com `alt=""`.
- [ ] Vídeos com legendas (WebVTT) e controles; nada toca sozinho com som.

### Interação
- [ ] Alvos de toque ≥ 24×24 px (2.5.8), recomendado 44×44.
- [ ] Formulários: `label` visível, `autocomplete` correto, erros associados (`aria-describedby`) e anunciados (`aria-live`), sem limpar o que foi digitado.
- [ ] Autenticação acessível (3.3.8): passkey e GitHub, sem teste cognitivo.
- [ ] Nada muda de contexto só por foco ou digitação.

### Movimento
- [ ] `prefers-reduced-motion` respeitado; toggle "reduzir movimento" no site.
- [ ] Movimento automático com mais de 5 s pode ser pausado (2.2.2); sem flashes acima de 3/s (2.3.1).
- [ ] Texto dividido pelo SplitText é lido como frase única por leitores de tela.

### Leitor de tela (VoiceOver no macOS; NVDA quando possível)
- [ ] Título da página e do conteúdo anunciados na navegação entre rotas (anúncio de rota do Nuxt).
- [ ] Links com nomes únicos e compreensíveis fora de contexto ("Ler artigo: <título>").
- [ ] Bloco de código: linguagem anunciada; botão "copiar" com rótulo e confirmação anunciada.
- [ ] Embeds com facade: botão com nome ("Reproduzir vídeo: <título>").

## 3. Diretrizes de conteúdo (o editor ajuda a cumprir)

- O campo `alt` é obrigatório ao inserir imagem informativa; a interface explica a diferença para a legenda.
- Links: texto descritivo; o editor avisa sobre textos como "clique aqui".
- Títulos: usar níveis em ordem; o editor não permite H1 no corpo.
- Tabelas: só para dados; com cabeçalho.
- Tradução: `alt` e legendas traduzidos junto com o conteúdo (fluxo de IA + revisão).

## 4. Antes do lançamento

- Passada manual completa com VoiceOver em R1–R8 e no fluxo editorial do admin.
- Resultado registrado no relatório do `/release-check`.
