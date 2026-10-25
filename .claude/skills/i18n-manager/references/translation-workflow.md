# Fluxo de tradução assistida (ADR-0009)

## Estados por localização (≠ pt-BR)

`missing` → (IA) `machine` → (edição) `in_review` → (aprovação humana) `approved` → (origem muda) `outdated` → `in_review` → `approved`

- **Publicar exige `approved`** + `translation:approve` + `*:publish` + o pt-BR publicado.
- `outdated` é calculado por segmento: `segments_meta[id].sourceHash` ≠ hash atual do segmento pt-BR.

## Segmentação (`shared/content/segmenter.ts`)

| Entra como segmento | Protegido (nunca enviado) |
|---|---|
| Blocos textuais (por `id`), título, resumo, `seo_title`, `seo_description`, slug sugerido, alt, legenda e crédito de mídia, nomes de temas, campos localizados das configurações | Blocos de código, código inline, URLs, IDs, termos `doNotTranslate` do glossário |

- Marcas inline viram placeholders (`<b>…</b>`, `<i>…</i>`, `<c>…</c>`, `<a1>…</a1>`).
- Na volta, valida-se a quantidade e a ordem das tags e o total de segmentos. Divergência → segmento `failed` (edição manual), sem corromper o documento.

## Execução e custo

1. `POST …/translations/estimate` → tokens, neurons e US$ (provedores pagos); mostra o saldo do dia (UTC) e do mês.
2. O usuário confirma.
3. `POST …/translations/run`: lotes de ≤ ~3 mil tokens, ≤ 20 chamadas por request; o guarda de custo roda **antes de cada lote**:
   - `enabled`;
   - `dailyNeuronCap` (padrão 8.000);
   - `monthlyBudgetMicroUsd` (padrão 0);
   - `perJobMaxMicroUsd`.
4. Cada lote grava os segmentos (`machine`) e atualiza `translation_jobs` (uso real ou estimado, `usage_estimated`). Uma falha preserva os lotes concluídos e permite retomar.

## Prompt (estrutura fixa por idioma de destino)

- Papel: tradutor técnico profissional pt-BR → `<idioma>`; preservar o sentido, o tom profissional e a formalidade de `ai_translation.style[locale]`.
- Regras: manter os placeholders exatamente; não traduzir nomes próprios nem termos do glossário marcados; não adicionar nem omitir conteúdo.
- Glossário do idioma (termo → tradução) incluído.
- Saída: JSON `{ "segments": [{ "id": string, "text": string }] }`, validada por schema. A saída é **dado**, nunca instrução.

## Privacidade e segurança

- Só conteúdo destinado à publicação. Nunca mensagens de contato, dados de usuário ou rascunhos marcados como privados.
- Testes usam o `FakeTranslationProvider`. Chamada real só no preview, com autorização do owner.
- Ativar Claude (ou outro provedor pago) exige ADR + aprovação + segredo + teto mensal maior que zero.
