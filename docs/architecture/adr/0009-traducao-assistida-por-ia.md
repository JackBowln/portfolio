# ADR-0009 — Tradução assistida por IA: Workers AI agora, Claude opcional depois

- **Status:** Aceito (2026-10-25)
- **Decisores:** Owner · Claude Code
- **Relacionados:** ADR-0006, ADR-0008, [data-model](../data-model.md), RF-11, RNF-08

## Contexto

- O conteúdo é escrito em pt-BR e precisa de versões en, es, de e fr revisadas por humano, com controle de custos e detecção de desatualização.
- O owner escolheu **Workers AI agora** (10 mil neurons/dia, sem excedente no Free, ou seja, teto natural de US$ 0) e **Claude como provedor futuro opcional**, com teto de gastos e aprovação.
- Estimativas para um artigo de ~2 mil palavras nos 4 idiomas:
  - Workers AI `gpt-oss-120b`: ≈ 1.600 neurons;
  - Gemma 4 26B: ≈ 580 neurons;
  - Claude (referência): ≈ US$ 0,01 (Haiku 5.5), US$ 0,19 (Sonnet 5.5) e US$ 0,38 (Opus 5.5).

## Decisão

1. **Escopo.** Artigos, projetos, páginas editáveis, nomes de temas e tecnologias, alt, legenda e crédito de mídia, e campos localizados das configurações. As strings de UI do repositório **não** entram no fluxo do CMS.
2. **Interface.** `server/services/translation/providers/types.ts` expõe:
   - `estimate(req) → { inputTokens, outputTokens, neurons?, costMicroUsd }`;
   - `translate(req) → { segments, usage }`.

   Implementações: `WorkersAiProvider` (v1) e, no futuro, `AnthropicProvider`, que exige ADR de ativação e o segredo `ANTHROPIC_API_KEY`.
3. **Segmentação.** `shared/content/segmenter.ts` é uma função pura.
   - **O que vira segmento:** cada bloco textual (pelo `id` do UniqueID), mais título, resumo, campos SEO e slug sugerido.
   - **Marcas inline:** viram tags-placeholder (`<b>`, `<i>`, `<c>`, `<a1>`) que o modelo deve preservar.
   - **O que nunca é enviado:** código, URLs e termos `doNotTranslate` do glossário.
   - **Validação da volta:** quantidade e ordem das tags e o total de segmentos. Uma divergência marca o segmento como falho, para edição manual.
4. **Prompt.**
   - Instruções fixas por idioma de destino: tom profissional; formalidade por idioma em `site_settings.ai_translation.style`, por exemplo "Sie" ou "du" em alemão; preservar placeholders; não traduzir nomes próprios.
   - Mais o glossário e a saída em JSON estruturado (`{ id, text }[]`).
   - Lotes de no máximo ~3 mil tokens por chamada e no máximo 20 chamadas por request (limite de subrequests). Documentos maiores continuam em requests seguintes, disparados pela interface.
5. **Modelo.** Configurável nas configurações. O padrão sai da avaliação da F09-T3: qualidade em 3 artigos reais × 4 idiomas, custo em neurons e preservação das tags. Candidatos: `@cf/openai/gpt-oss-120b`, `@cf/google/gemma-4-26b-a4b-it`, `@cf/qwen/qwen3-30b-a3b-fp8`, `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
6. **Controle de custo.**
   - **Antes de executar:** estimativa de tokens e neurons e de US$ para provedores pagos, mostrada na interface. Executar exige confirmação explícita.
   - **Limites configuráveis em `site_settings.ai_translation`:**
     - teto diário de neurons (padrão 8.000, abaixo do limite gratuito);
     - teto mensal em US$ (padrão US$ 0; só relevante com Paid ou Claude);
     - teto por job;
     - chave geral `enabled`.
   - **Ledger:** cada execução grava em `translation_jobs` o uso real (ou o estimado, quando o provedor não reporta), em micro-USD e neurons.
   - Antes de cada lote, o serviço confere o saldo e interrompe com erro claro se o teto for atingido.
7. **Retradução incremental.** Cada segmento guarda o `sourceHash` do original. Mudou o original, o segmento fica `outdated`, e a ação padrão retraduz **só** os segmentos alterados.
8. **Estados por localização:** `missing → machine → in_review → approved`; `approved → outdated` quando algum segmento de origem muda depois da aprovação.
   - Publicar um idioma exige `approved` e as permissões `translation:approve` e `article:publish` (ou equivalente).
   - **Nada traduzido por máquina é publicado sem revisão humana.**
9. **Revisão.** Interface lado a lado por segmento: original e tradução editável, destaque dos `outdated` e diff contra a tradução anterior. O slug traduzido é sugerido e editável.
10. **Privacidade.** Só conteúdo destinado à publicação é enviado. Mensagens de contato, dados de usuário e rascunhos marcados como privados nunca vão para o provedor.
11. **Ativação futura do Claude.**
    - Exige ADR de atualização, aprovação do owner, segredo configurado e teto mensal maior que zero.
    - O SDK é `@anthropic-ai/sdk`, com prompt caching no prefixo fixo (instruções + glossário) e Batch API opcional (−50%) para retraduções em lote.
    - O modelo é escolhido pelo owner: o padrão recomendado pela Anthropic é `claude-opus-5-5`; `claude-sonnet-5-5` e `claude-haiku-5-5` são mais baratos.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Claude desde já | O owner preferiu começar sem custo; o adaptador mantém a porta aberta |
| `m2m100` (modelo dedicado de tradução) | Não preserva marcação e tem qualidade inferior em prosa técnica longa |
| Traduzir o documento JSON inteiro | O modelo pode corromper a estrutura; não permite retradução incremental |
| Publicação automática da tradução | Viola a revisão humana obrigatória (RF-11.2) |

## Consequências

### Positivas
- Custo zero garantido no Free; retradução só do que mudou; estrutura do documento protegida.

### Negativas e custos
- A qualidade do Workers AI pode exigir mais revisão manual em de/fr.
- O limite diário restringe traduções em massa (alguns artigos por dia).

### Riscos e mitigação
- **Modelos do Workers AI mudarem ou serem descontinuados:** o modelo é configurável e a avaliação está documentada; trocar não exige deploy.
- **Prompt injection vinda do próprio conteúdo:** a saída é tratada como dado (validada por schema) e nunca executa ações; o conteúdo é do owner.

## Validação

- F09-T2: testes de propriedade do segmentador (extrair → reinserir = identidade); marcas e código preservados.
- F09-T3: avaliação de modelos registrada nesta seção (tabela de qualidade e custo); teste do teto (um job acima do saldo é bloqueado antes da chamada).

| Avaliação F09-T3 | Modelo | Qualidade (1–5) por idioma | Neurons/artigo | Data |
|---|---|---|---|---|
| _pendente_ | | | | |

## Referências

- [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- Anthropic: preços e modelos (consulta de 06/10/2026, registrada na [pesquisa](../../research/2026-10-25-compatibilidade.md))
