# F04 — Mídia

**Objetivo da fase:** upload seguro, variantes responsivas geradas no navegador do admin, entrega imutável e uma biblioteca de mídia com metadados por idioma.

**Pré-requisitos:** F03 concluída (admin autenticado, RBAC, hardening).

**Leitura obrigatória:** [ADR-0007](../architecture/adr/0007-midia.md), [data-model §5](../architecture/data-model.md#5-mídia), [ADR-0012](../architecture/adr/0012-seguranca.md), [accessibility](../quality/accessibility.md).

**Gate de saída:** upload → variantes → finalize → entrega com `<ResponsiveImage>` funcionando de ponta a ponta, todos os casos maliciosos rejeitados e Lighthouse sem avisos de imagem numa página de teste.

---

### F04-T1 — Schema de mídia e API de upload com validação

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | F03 (gate) | RF-06.1, RF-06.6, RNF-07 | `/security-audit`, `/cms-engineer` |

**Objetivo.** Criar as tabelas `media`, `media_localizations`, `media_tracks` e `media_usages` e os endpoints:
- `POST /api/admin/media` (manifesto);
- `PUT …/:id/variants/:name` (streaming para o R2);
- `POST …/:id/finalize`;
- `GET` de lista e de detalhe, `PATCH` de metadados e `DELETE` (exclusão lógica).

**Arquivos prováveis.** `server/db/schema/media.ts`, migração, `server/services/media/*.ts`, `server/api/admin/media/**`, `server/utils/magic-bytes.ts`, `shared/media/schemas.ts`.

**Fora do escopo.** Processamento no cliente (T2) e interface (T4).

**Critérios de aceite**
- [x] Permissões `media:*` aplicadas via `defineAdminHandler`.
- [x] MIME por allowlist **e** magic bytes do primeiro chunk; limites (variante ≤ 10 MB, original ≤ 25 MB, vídeo ≤ 95 MB); nome e número das variantes conferidos contra o manifesto.
- [x] Chave do R2 gerada pelo servidor (`media/{sha2}/{sha256}/{variant}.{ext}`); nenhum caminho controlado pelo usuário.
- [x] `finalize` falha se faltar alguma variante; `DELETE` com uso em `media_usages` → 409.
- [x] Toda mutação é auditada.

**Testes**
- API: polyglot (JPEG com payload), SVG renomeado para `.png`, MIME divergente, arquivo acima do limite, variante fora do manifesto → todos rejeitados; o fluxo feliz completo funciona.
- Workers: o repositório de mídia e as regras de uso.

**Resultado (29/10/2026).**
- **Schema:** `server/db/schema/media.ts` e a migração `0003_media` (aplicada só com `--local`): `media`, `media_localizations`, `media_tracks` e `media_usages`, com a coluna nova `decorative`.
- **API** em `server/api/admin/media/**`, todas com `defineAdminHandler`: `POST` (manifesto), `PUT …/:id/variants/:name` (streaming para o R2), `POST …/:id/finalize`, `GET` de lista e de detalhe, `PATCH` e `DELETE` (lógico, 409 em uso).
- **Validação:** `shared/media/schemas.ts` (manifesto), `shared/media/keys.ts` (nomes e chaves), `server/utils/magic-bytes.ts` (tipo e marcação nos primeiros 64 KB) e `server/services/media/upload.ts` (`FixedLengthStream`). O middleware de origem ganhou a exceção do upload binário.
- **CI:** passou a aplicar as migrações no D1 local antes da Playwright (faltava desde a F03).
- **Decisões:** ADR-0007, "Decisões da F04-T1".
- **Testes:** `tests/api/media.spec.ts`, `tests/workers/media.test.ts`, `tests/unit/magic-bytes.test.ts` e `tests/unit/media-manifest.test.ts`.

---

### F04-T2 — Pipeline de imagem no navegador do admin (WASM)

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| concluída | F04-T1 | RF-06.2, RNF-08 | `/cms-engineer`, `/architecture-guardian`, `/performance-audit` |

**Objetivo.** Rodar num Web Worker:
- decodificação, orientação e remoção de EXIF/GPS;
- larguras `[320, 640, 960, 1280, 1920, 2560]`;
- codificação AVIF, WebP e JPEG;
- ThumbHash convertido em data URL, cor dominante e SHA-256;

com progresso e cancelamento na interface.

**Arquivos prováveis.** `app/workers/image-pipeline.worker.ts`, `app/composables/admin/useImagePipeline.ts`, as dependências de codec (avaliar `@jsquash/*` e `thumbhash`: licença, tamanho e manutenção).

**Fora do escopo.** Vídeo (sem transcodificação; T4 trata do upload direto).

**Critérios de aceite**
- [x] Checklist de dependência do guardian para cada codec, com tamanho do WASM e licença registrados; os codecs só carregam no admin, sob demanda.
- [x] Os metadados EXIF/GPS são removidos (verificado num arquivo de teste com GPS).
- [x] Uma imagem de 4000×3000 é processada sem travar a interface (o trabalho fica no Worker); o tempo é registrado.
- [x] A saída é determinística para a mesma entrada (mesmo SHA-256 da variante).

**Testes**
- Nuxt/unit: as funções puras (cálculo de larguras, montagem do manifesto).
- E2E (Chromium): upload de uma imagem de fixture, com as variantes criadas e listadas.

**Resultado (29/10/2026).**
- **Pipeline:** `app/workers/admin/image-pipeline.worker.ts`, `app/composables/admin/useImagePipeline.ts` e `useMediaUpload.ts`, e as funções puras em `shared/media/pipeline.ts`. Tela mínima de envio em `/admin/midia` (`MediaUploader`), com progresso por etapa e cancelamento; a biblioteca completa fica na T4.
- **Dependências:** `@jsquash/avif`, `webp`, `jpeg` e `resize` e `thumbhash`, só no Worker do admin, com a exceção de manutenção aprovada (ADR-0007, "Decisões da F04-T2").
- **Medidas:** 4000×3000 em 8,2 s, nenhuma tarefa longa na thread principal; ~1,36 MB de WASM no primeiro envio ([perf-log](../quality/perf-log.md)).
- **CSP:** nenhuma página ganhou `'wasm-unsafe-eval'`; os scripts de `/_nuxt/` levam uma CSP que só vale para Workers (ADR-0012, "Decisões da F04-T2").
- **Testes:** `tests/unit/media-pipeline.test.ts`, `tests/e2e/media-pipeline.spec.ts`, a CSP no `hardening.spec` e a tela no `a11y/admin.spec`.

---

### F04-T3 — Entrega e componentes `<ResponsiveImage>` e `<MediaVideo>`

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F04-T1 | RF-06.2, RNF-01, RNF-03 | `/frontend-design`, `/performance-audit` |

**Objetivo.** Criar a rota de mídia para local e preview (streaming do R2 com headers imutáveis) e o suporte a `MEDIA_BASE_URL`. Criar `<ResponsiveImage>` (`picture`, `srcset`/`sizes`, `width`/`height`, `alt` do idioma, placeholder, ponto de foco, prioridade do LCP) e `<MediaVideo>` (poster, `track` por idioma, `preload="none"`, controles).

**Arquivos prováveis.** `server/routes/media/[...key].ts`, `app/components/media/ResponsiveImage.vue`, `app/components/media/MediaVideo.vue`, `app/composables/useMediaUrl.ts`.

**Fora do escopo.** Galeria ampliável (F05-T4).

**Critérios de aceite**
- [ ] Headers da mídia: `public, max-age=31536000, immutable`, `nosniff`, `Content-Type` vindo do registro, `Content-Disposition: inline`.
- [ ] Sem CLS (dimensões sempre presentes); `fetchpriority="high"` só quando `priority` for passado.
- [ ] Lighthouse numa página de teste sem "Properly size images", "Serve images in modern formats" nem "Image elements do not have explicit width and height".
- [ ] Vídeo sem autoplay, com legendas selecionáveis.

**Testes**
- Nuxt: o markup gerado (sources, srcset, sizes, alt e atributos de prioridade).
- API: os headers da rota de mídia.
- `/performance-audit` na página de teste.

---

### F04-T4 — Biblioteca de mídia no admin

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F04-T2, F04-T3 | RF-06.3, RF-06.4, RF-06.5, RF-06.6 | `/cms-engineer`, `/frontend-design`, `/i18n-manager` |

**Objetivo.** Criar a biblioteca de mídia:
- grade com busca e filtros (tipo, data, sem alt);
- edição de alt, legenda e crédito por idioma, com aviso de alt ausente;
- seletor de ponto de foco;
- lista de usos e exclusão segura;
- upload de vídeo (MP4/WebM), com poster obrigatório e legendas WebVTT por idioma, e um guia de otimização.

Inclui também o componente "seletor de mídia", reaproveitado pelo editor (F05-T3).

**Arquivos prováveis.** `app/pages/admin/midia/index.vue`, `app/components/admin/media/*.vue`, `server/api/admin/media/**` (ajustes).

**Fora do escopo.** Tradução automática de alt (F09).

**Critérios de aceite**
- [ ] Alt obrigatório para imagem informativa; a opção "decorativa" é explícita.
- [ ] Exclusão bloqueada com a lista de onde a mídia é usada.
- [ ] Interface operável por teclado; axe sem violações sérias ou críticas.

**Testes**
- E2E: upload → editar alt nos 5 idiomas → definir o foco → tentar excluir mídia em uso (bloqueado) → excluir mídia sem uso.

---

## Prompt da fase

```text
Fase F04 — Mídia. Projeto: ~/Desktop/dev/portfolio.

Leia CLAUDE.md, docs/roadmap/F04-midia.md, o ADR-0007 e o data-model §5. Pegue a primeira tarefa "pendente" com dependências concluídas.

Antes de editar: apresente objetivo, arquivos, abordagem, dependências novas (checklist do /architecture-guardian com licença, tamanho e compatibilidade de cada codec), testes e riscos. Aguarde minha aprovação.

Regras desta fase:
- Nenhum processamento de imagem no Worker (CPU): o servidor só valida e grava.
- Validar por magic bytes; chaves do R2 geradas pelo servidor; SVG de usuário bloqueado.
- Use /security-audit na F04-T1 e /performance-audit nas F04-T2 e F04-T3.

Depois de implementar: rode typecheck, lint, test, test:api e os e2e de mídia; cole a saída real; atualize o status e os docs; entregue o relatório da Definition of Done. Não faça commit sem eu pedir.
```
