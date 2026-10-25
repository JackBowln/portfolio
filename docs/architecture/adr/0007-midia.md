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

- F04-T1: testes enviam um polyglot, um SVG renomeado, um arquivo acima do limite e um MIME divergente, e todos são rejeitados.
- F04-T3: Lighthouse sem "Properly size images" nem "Serve images in modern formats" nas páginas com mídia.

## Referências

- [R2 pricing](https://developers.cloudflare.com/r2/pricing/) · [Images pricing](https://developers.cloudflare.com/images/pricing/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) (tamanho de body)
