# Máquina de estados de publicação — implementação

Estados por localização: `draft`, `scheduled`, `published` e `unpublished` (diagrama no data-model §8).

## Transições e guardas

| De → para | Ação | Permissão | Guardas |
|---|---|---|---|
| `draft` → `published` | publicar | `*:publish` | Documento válido; slug único no idioma; se ≠ pt-BR: `translation_state = approved` e pt-BR publicado (ou no mesmo batch) |
| `draft` → `scheduled` | agendar | `*:schedule` | `scheduled_at` > agora + 1 min; as mesmas guardas da publicação, avaliadas de novo no disparo |
| `scheduled` → `draft` | cancelar | `*:schedule` | — |
| `scheduled` → `published` | cron | sistema | As guardas reavaliadas; se falharem: volta para `draft` com auditoria `publish_failed` e motivo |
| `published` → `published` | publicar nova revisão | `*:publish` | `working_hash` ≠ hash da revisão publicada (senão não faz nada) |
| `published` → `unpublished` | despublicar | `*:publish` | — |
| `unpublished` → `published` | publicar | `*:publish` | As mesmas da primeira publicação |

## Batch de publicação (atômico)

1. `INSERT article_revisions` (`kind = publish`, `snapshot_gz`, `content_hash`, `number + 1`).
2. `UPDATE article_localizations` com `published_revision_id`, `published_snapshot`, `published_slug`, `published_title`, `published_excerpt`, `published_cover_media_id`, `published_reading_time_min`, `published_at`, `status = published`, `version + 1`.
3. Se o `published_slug` mudou: `INSERT redirects (from = caminho antigo, to = caminho novo, 301)`.
4. Se for pt-BR: sincronizar `article_tags` com `draft_tag_ids`; marcar como `outdated` os segmentos das traduções afetadas (F09).
5. `UPDATE articles.first_published_at` se for nulo.
6. `INSERT audit_log`.

Depois do commit do batch: purgar as tags (content-model) e retornar a localização publicada.

## Cron `content:publish-due` (`*/5 * * * *`)

- Selecionar `status = 'scheduled' AND scheduled_at <= now`, ordenado por `scheduled_at`, `LIMIT 5` por execução (CPU ≤ 10 ms; o I/O não conta).
- Para cada item: reavaliar as guardas → batch de publicação → purge.
- **Idempotente:** usar `version` na condição do `UPDATE` (`WHERE id = ? AND version = ?`); uma segunda execução não duplica nada.
- Testar com relógio falso: horário passado publica, horário futuro não, guarda falha devolve para `draft` com auditoria.

## Fuso horário

O agendamento é exibido e informado no fuso padrão das configurações (Q-06) e gravado em UTC. Os testes cobrem a virada de horário de verão quando o fuso tiver DST.
