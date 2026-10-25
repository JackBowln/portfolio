# F04 — Mídia

**Objetivo da fase:** upload seguro, variantes responsivas geradas no navegador do admin, entrega imutável e uma biblioteca de mídia com metadados por idioma.

**Pré-requisitos:** F03 concluída (admin autenticado, RBAC, hardening).

**Leitura obrigatória:** [ADR-0007](../architecture/adr/0007-midia.md), [data-model §5](../architecture/data-model.md#5-mídia), [ADR-0012](../architecture/adr/0012-seguranca.md), [accessibility](../quality/accessibility.md).

**Gate de saída:** upload → variantes → finalize → entrega com `<ResponsiveImage>` funcionando de ponta a ponta, todos os casos maliciosos rejeitados e Lighthouse sem avisos de imagem numa página de teste.

---

### F04-T1 — Schema de mídia e API de upload com validação

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F03 (gate) | RF-06.1, RF-06.6, RNF-07 | `/security-audit`, `/cms-engineer` |

**Objetivo.** Criar as tabelas `media`, `media_localizations`, `media_tracks` e `media_usages` e os endpoints:
- `POST /api/admin/media` (manifesto);
- `PUT …/:id/variants/:name` (streaming para o R2);
- `POST …/:id/finalize`;
- `GET` de lista e de detalhe, `PATCH` de metadados e `DELETE` (exclusão lógica).

**Arquivos prováveis.** `server/db/schema/media.ts`, migração, `server/services/media/*.ts`, `server/api/admin/media/**`, `server/utils/magic-bytes.ts`, `shared/media/schemas.ts`.

**Fora do escopo.** Processamento no cliente (T2) e interface (T4).

**Critérios de aceite**
- [ ] Permissões `media:*` aplicadas via `defineAdminHandler`.
- [ ] MIME por allowlist **e** magic bytes do primeiro chunk; limites (variante ≤ 10 MB, original ≤ 25 MB, vídeo ≤ 95 MB); nome e número das variantes conferidos contra o manifesto.
- [ ] Chave do R2 gerada pelo servidor (`media/{sha2}/{sha256}/{variant}.{ext}`); nenhum caminho controlado pelo usuário.
- [ ] `finalize` falha se faltar alguma variante; `DELETE` com uso em `media_usages` → 409.
- [ ] Toda mutação é auditada.

**Testes**
- API: polyglot (JPEG com payload), SVG renomeado para `.png`, MIME divergente, arquivo acima do limite, variante fora do manifesto → todos rejeitados; o fluxo feliz completo funciona.
- Workers: o repositório de mídia e as regras de uso.

---

### F04-T2 — Pipeline de imagem no navegador do admin (WASM)

| Status | Depende de | Requisitos | Skills |
|---|---|---|---|
| pendente | F04-T1 | RF-06.2, RNF-08 | `/cms-engineer`, `/architecture-guardian`, `/performance-audit` |

**Objetivo.** Rodar num Web Worker:
- decodificação, orientação e remoção de EXIF/GPS;
- larguras `[320, 640, 960, 1280, 1920, 2560]`;
- codificação AVIF, WebP e JPEG;
- ThumbHash convertido em data URL, cor dominante e SHA-256;

com progresso e cancelamento na interface.

**Arquivos prováveis.** `app/workers/image-pipeline.worker.ts`, `app/composables/admin/useImagePipeline.ts`, as dependências de codec (avaliar `@jsquash/*` e `thumbhash`: licença, tamanho e manutenção).

**Fora do escopo.** Vídeo (sem transcodificação; T4 trata do upload direto).

**Critérios de aceite**
- [ ] Checklist de dependência do guardian para cada codec, com tamanho do WASM e licença registrados; os codecs só carregam no admin, sob demanda.
- [ ] Os metadados EXIF/GPS são removidos (verificado num arquivo de teste com GPS).
- [ ] Uma imagem de 4000×3000 é processada sem travar a interface (o trabalho fica no Worker); o tempo é registrado.
- [ ] A saída é determinística para a mesma entrada (mesmo SHA-256 da variante).

**Testes**
- Nuxt/unit: as funções puras (cálculo de larguras, montagem do manifesto).
- E2E (Chromium): upload de uma imagem de fixture, com as variantes criadas e listadas.

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
