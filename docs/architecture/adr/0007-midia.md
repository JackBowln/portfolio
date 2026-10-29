# ADR-0007 — Mídia: R2 com variantes geradas no navegador do admin

- **Status:** Aceito (2026-10-25)
- **Decisores:** Owner · Claude Code
- **Relacionados:** ADR-0003, ADR-0006, ADR-0012, RF-06, RF-07.2, RNF-01, RNF-07, RNF-08

## Contexto

- As imagens precisam de formatos modernos e srcset para o Lighthouse 100.
- No Free, o Image Transformations dá 5.000 transformações únicas por mês e depois falha com erro 9422.
- Processar imagem no Worker estoura os 10 ms de CPU.
- R2 tem 10 GB grátis e egress grátis.
- O limite de body por request no plano Free é de 100 MB.

## Decisão

1. **Armazenamento.**
   - Bucket R2 `MEDIA` por ambiente.
   - Chaves endereçadas por conteúdo, `media/{sha256[0:2]}/{sha256}/{variant}.{ext}`, o que permite cache imutável.
   - Originais em `originals/` (nunca servidos publicamente), para reprocessamento futuro.
2. **Pipeline no admin** (Web Worker; os codecs WASM `@jsquash/avif`, `@jsquash/webp` e `@jsquash/jpeg` são avaliados na F04-T2):
   - decodifica, corrige orientação e remove metadados (EXIF/GPS);
   - gera larguras `[320, 640, 960, 1280, 1920, 2560]`, até a largura original;
   - codifica em AVIF, WebP e JPEG (fallback);
   - gera placeholder ThumbHash (convertido em data URL pequeno), cor dominante e SHA-256 (WebCrypto).
3. **Upload.**
   1. `POST /api/admin/media` cria o registro `pending` com o manifesto das variantes.
   2. `PUT /api/admin/media/:id/variants/:name` envia em streaming para o R2, sem buffer.
   3. `POST /api/admin/media/:id/finalize` marca como pronto.

   O servidor valida:
   - permissão `media:create`;
   - MIME por allowlist e **magic bytes** do primeiro chunk;
   - tamanho: variante ≤ 10 MB, original ≤ 25 MB, vídeo ≤ 95 MB;
   - número e nomes das variantes contra o manifesto;
   - dimensões plausíveis.

   O nome da chave nunca vem do usuário.
4. **Tipos aceitos.**
   - **Imagens:** JPEG, PNG, WebP e AVIF.
   - **Vídeo:** MP4 (H.264/AAC) e WebM, com poster obrigatório e legendas WebVTT por idioma.
   - **SVG enviado pelo usuário é bloqueado** (risco de XSS). Ícones e ilustrações SVG ficam versionados no repositório.
5. **Entrega.**
   - Em produção, por um domínio de mídia ligado ao bucket (`MEDIA_BASE_URL`, com Cache Rules de TTL longo). Em preview e local, pela rota `server/routes/media/[...key].ts` (streaming do R2).
   - Cabeçalhos: `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` e `Content-Type` vindo do registro (nunca da extensão).
6. **Componente `<ResponsiveImage>`.**
   - Gera `<picture>` com `source` AVIF e WebP, `img` JPEG com `srcset`/`sizes`, `width`/`height` explícitos e `alt` do idioma.
   - Usa `loading="lazy"` por padrão, ou `fetchpriority="high"` e `loading="eager"` para o LCP.
   - Placeholder ThumbHash por CSS; recorte respeita o ponto de foco (`object-position`).
7. **Imagem OG.**
   - Gerada no admin por Canvas na publicação de cada idioma: 1200×630, com título, nome do site e acento visual, enviada como mídia `og`.
   - Fallback: OG padrão por idioma nas configurações.
   - O `nuxt-og-image` não é usado em runtime.
8. **Ciclo de vida.**
   - Mídia em uso (`media_usages`) não pode ser apagada (409).
   - Exclusão lógica; o cron remove os objetos do R2 30 dias depois, com auditoria.

### Decisões da F04-T1 (owner, 2026-10-29)

- **Manifesto** (`shared/media/schemas.ts`, zod `strict`): imagem com original, dimensões, `sha256`, placeholder e cor dominante, mais as variantes `{format, width, height, size}`; vídeo com duração, `posterMediaId` (imagem `ready`) e legendas `{locale, kind, label, size}`.
  - As larguras saem de `IMAGE_WIDTHS` ou, para originais mais estreitos que 320 px, da própria largura. Nunca passam do original, mantêm a proporção (±1 px) e cada largura vem nos 3 formatos.
  - Limites em bytes decimais: variante 10 MB, original 25 MB, vídeo 95 MB, legenda 1 MB, até 10 legendas.
- **Nomes e chaves:** o servidor deriva os nomes (`avif-640`, `original`, `captions-pt-BR`) e as chaves (`shared/media/keys.ts`); o vídeo fica em `media/{sha2}/{sha256}/video.{ext}` e o original de imagem em `originals/{sha256}.{ext}`. A chave do original nunca sai da API.
- **`sha256`:** declarado pelo admin e validado só pelo formato e pela unicidade, sem recalcular no Worker (CPU). Ele é único na tabela, inclusive entre itens apagados, então um upload nunca sobrescreve o objeto de outro registro; repetir responde 409 com o id existente.
- **Upload** (`PUT …/variants/:name`): `Content-Type` e `Content-Length` iguais aos declarados, senão 415/400 antes de ler o corpo. Os primeiros 64 KB passam por magic bytes (`server/utils/magic-bytes.ts`) e por uma busca de marcação (`<script`, `<html`, `<svg`, `<?xml`, `<!doctype`, `<iframe`, `<object`, `<embed`, `<?php`); o resto vai ao R2 por `FixedLengthStream`, sem buffer. Só quem criou o item envia arquivos e finaliza. O middleware de origem aceita corpo binário só nessa rota, com teto de 95 MB, e mantém a checagem de origem.
- **Finalize:** `head()` de cada chave no R2 confere existência e tamanho; o que faltar volta no 409. Um vídeo finalizado registra o uso do poster (`context: 'poster'`), que bloqueia apagar o poster.
- **Auditoria:** `media.created`, `media.finalized` (com o resumo: arquivos e bytes), `media.updated`, `media.deleted` e `media.upload_rejected` (motivo `type_mismatch`, `markup` ou `size_mismatch`). Os uploads aceitos não geram uma linha cada.
- **Metadados:** alt, legenda e crédito por idioma (pt-BR `source`, os outros `approved`, porque foram digitados por uma pessoa), ponto de foco e a coluna nova `decorative`. O alt obrigatório é cobrado na publicação (F05/F06).
- **Exclusão lógica:** `status = 'deleted'` + `deleted_at`. Os objetos do R2 e os itens `pending` abandonados ficam para o cron da F06.
- **Risco aceito:** só a cabeça do arquivo é inspecionada (varrer 10 MB estoura a CPU). Uma carga no fim do arquivo continua contida por `nosniff`, `Content-Type` do registro, `Content-Disposition: inline`, a origem separada de mídia em produção, originais nunca servidos e variantes re-encodadas no pipeline (F04-T2).

### Decisões da F04-T2 (owner, 2026-10-29)

- **Onde roda:** `app/workers/admin/image-pipeline.worker.ts`, um Web Worker por arquivo, criado por `useImagePipeline`. Cancelar encerra o Worker (`terminate()`) e aborta os `fetch` do `useMediaUpload`.
- **Decodificação nativa:** `createImageBitmap` (orientação EXIF aplicada) e `getImageData` do `OffscreenCanvas` em sRGB, que converte Display P3. Nenhum decoder WASM. O determinismo vale por motor de navegador: o mesmo arquivo dá os mesmos bytes no mesmo navegador.
- **Redimensionamento e codificação:** `@jsquash/resize` (Lanczos3) e `@jsquash/avif` (qualidade 50, speed 6, thread única), `@jsquash/webp` (80) e `@jsquash/jpeg` (mozjpeg 78, progressivo). No JPEG a transparência é achatada sobre branco.
- **Metadados:** as variantes saem dos pixels, sem metadados. O original é limpo sem perda (`shared/media/pipeline.ts`): o JPEG perde APP1 (Exif/XMP), APP3–APP13, APP15 e COM, e guarda o ICC, o APP14 e só a orientação, num APP1 mínimo; o PNG perde `eXIf`, `tEXt`, `zTXt`, `iTXt` e `tIME`; o WebP perde `EXIF` e `XMP`, com as flags do VP8X e o tamanho do RIFF corrigidos. Um AVIF de entrada é re-codificado em resolução cheia (qualidade 80). O `sha256` é o do original já limpo.
- **Placeholder:** ThumbHash de uma miniatura de até 100 px, renderizado e codificado como WebP pequeno em data URL (o PNG sem compressão do `thumbhash` passaria dos 4096 caracteres). A cor dominante é a média do ThumbHash.
- **Exceção de manutenção** (aprovada pelo owner): `@jsquash/avif` 2.1.1 (2025-05), `@jsquash/jpeg` 1.6.0 (2025-05), `@jsquash/webp` 1.5.0 (2025-08) e `thumbhash` 0.1.1 (2023-03) passam dos 12 meses sem release. O monorepo jSquash segue ativo (`@jsquash/resize` 2.1.1 em 2026-01), os codecs são wrappers estáveis de libavif, libwebp e mozjpeg, e o `thumbhash` é um algoritmo fechado. Revisar a cada atualização de dependências.

| Pacote | Versão | Destino | gzip | Licença | Último release | Workers ok |
|---|---|---|---|---|---|---|
| `@jsquash/avif` | 2.1.1 | Worker do admin | 1.116 KB (WASM) | Apache-2.0 | 2025-05 | não se aplica (navegador) |
| `@jsquash/webp` | 1.5.0 | Worker do admin | 114–126 KB (WASM) | Apache-2.0 | 2025-08 | idem |
| `@jsquash/jpeg` | 1.6.0 | Worker do admin | 59 KB (WASM) | Apache-2.0 | 2025-05 | idem |
| `@jsquash/resize` | 2.1.1 | Worker do admin | 17 KB (WASM) | Apache-2.0 | 2026-01 | idem |
| `thumbhash` | 0.1.1 | Worker do admin | 3,3 KB | MIT | 2023-03 | idem |

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Cloudflare Image Transformations (`/cdn-cgi/image`) | Teto de 5.000 transformações por mês no Free; depois, erro 9422 |
| Cloudflare Images (storage) | Pago |
| Processar no Worker (WASM) | CPU muito acima de 10 ms |
| `@nuxt/image` + IPX | Depende de Node e sharp; não roda no Workers |
| Canvas nativo para codificar | O Safari não codifica WebP/AVIF por canvas; resultados inconsistentes |

## Consequências

### Positivas
- Custo zero, saída determinística, cache imutável e Lighthouse sem avisos de imagem.

### Negativas e custos
- O upload no admin fica mais lento (AVIF leva segundos) e o bundle do admin carrega codecs WASM sob demanda.
- Vídeo não é transcodificado: o owner envia arquivos já otimizados (guia na biblioteca de mídia).

### Riscos e mitigação
- **Arquivo malicioso com extensão falsa:** checagem de magic bytes + `nosniff` + `Content-Type` controlado.
- **Variantes faltando:** o `finalize` confere o manifesto antes de liberar o uso.

## Validação

- F04-T1: testes enviam um polyglot, um SVG renomeado, um arquivo acima do limite e um MIME divergente, e todos são rejeitados. Feito em `tests/api/media.spec.ts` (também tamanho divergente, variante fora do manifesto, legenda com `<script>`, hash repetido, finalize incompleto e RBAC), `tests/unit/magic-bytes.test.ts`, `tests/unit/media-manifest.test.ts` e `tests/workers/media.test.ts`.
- F04-T2: `tests/unit/media-pipeline.test.ts` (larguras, manifesto, remoção de metadados em JPEG, PNG e WebP) e `tests/e2e/media-pipeline.spec.ts` (nenhum EXIF/GPS sai do navegador, saída idêntica para o mesmo arquivo, 4000×3000 em 8,2 s sem tarefa longa na thread principal, envio e listagem, cancelamento, formato recusado).
- F04-T3: Lighthouse sem "Properly size images" nem "Serve images in modern formats" nas páginas com mídia.

## Referências

- [R2 pricing](https://developers.cloudflare.com/r2/pricing/) · [Images pricing](https://developers.cloudflare.com/images/pricing/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) (tamanho de body)
