# Modelo de conteúdo — resumo operacional

Especificação completa: `docs/architecture/data-model.md`. Isto é um guia rápido para não errar.

## Padrão entidade → localização → revisão

```
articles (sem idioma: autor, capa de trabalho, draft_tag_ids, featured)
  └─ article_localizations (1 por idioma)
       ├─ cópia de trabalho: title, slug, excerpt, body (JSON), seo_*, og_image_media_id, noindex
       ├─ derivados: word_count, reading_time_min, toc, working_hash, segments_meta
       ├─ publicação: status, scheduled_at, published_revision_id, published_snapshot, published_* (desnormalizados)
       ├─ tradução: translation_state, source_revision_id, reviewed_by/at
       └─ article_revisions (snapshot_gz imutável, kind, number, content_hash)
```

`projects` e `pages` seguem o mesmo padrão. As páginas não têm slug: usam `blocks` validados por schema de `PageKey`.

## Onde cada coisa é calculada

| Dado | Onde | Quando |
|---|---|---|
| HAST do código (Shiki) | Navegador do admin | Ao editar ou salvar o bloco de código |
| Variantes de imagem, ThumbHash, cor | Navegador do admin (Web Worker) | No upload |
| Imagem OG | Navegador do admin (Canvas) | Ao publicar um idioma (F11-T2) |
| Palavras, tempo de leitura, TOC, `media_usages`, hashes de segmento | Servidor (funções puras de `shared/content/derive.ts`) | A cada gravação |
| `published_snapshot` e `published_*` | Servidor | Ao publicar (batch) |

## Consultas públicas

- Detalhe: `(locale, published_slug)` → `published_snapshot` + alternates (localizações publicadas da mesma entidade).
- Lista: `published_revision_id IS NOT NULL AND deleted_at IS NULL ORDER BY published_at DESC, id DESC` (cursor).
- No máximo 4 queries por página em cache-miss; use `db.batch` para leituras independentes.

## Tags de cache por entidade (ADR-0003)

| Ação | Tags |
|---|---|
| Publicar ou despublicar um artigo `l` | `article:{id}:{l}`, `article:{id}`, `list:blog:{l}`, `tag:{tagId}` (cada tema), `sitemap`, `rss:{l}` |
| Publicar um projeto `l` | `project:{id}:{l}`, `project:{id}`, `list:projects:{l}`, `sitemap` |
| Publicar uma página `k` | `page:{k}:{l}`, `sitemap` |
| Configurações | `settings` |
| Texto de mídia | `media:{id}` |
| Redirect | `redirects` |
