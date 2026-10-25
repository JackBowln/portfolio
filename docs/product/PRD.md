# PRD — Portfólio profissional e blog pessoal

| | |
|---|---|
| **Status** | Aprovado para implementação faseada (25/10/2026) |
| **Dono do produto** | Owner do site (você) |
| **Implementação** | Claude Code, tarefa a tarefa, conforme [roadmap](../roadmap/README.md) |
| **Documentos relacionados** | [Arquitetura](../architecture/overview.md) · [Modelo de dados](../architecture/data-model.md) · [ADRs](../architecture/adr/) · [Compatibilidade](../research/2026-10-25-compatibilidade.md) |

## 1. Visão

Um site pessoal com qualidade de produto: portfólio e blog técnico, de design editorial e com uma home cinematográfica, rápido o bastante para alcançar 100 no Lighthouse e acessível. O conteúdo é publicado em português brasileiro e chega a inglês, espanhol, alemão e francês por um fluxo de tradução assistida por IA com revisão humana. Tudo é gerenciado por um CMS próprio, seguro e de custo próximo de zero.

## 2. Problema e oportunidade

- Portfólios genéricos não diferenciam: falta narrativa, prova de impacto e acabamento visual.
- Blogs técnicos multilíngues costumam ter traduções desatualizadas, SEO internacional quebrado (hreflang, canonical) e leitura lenta.
- CMS de terceiros trazem custo recorrente, lock-in ou JS pesado nas páginas públicas.

A oportunidade é unir narrativa visual (motion com propósito), leitura impecável e uma operação editorial que mantém as 5 versões sincronizadas sem custo fixo.

## 3. Objetivos e métricas de sucesso

| Objetivo | Métrica | Meta |
|---|---|---|
| Qualidade técnica percebida | Lighthouse (Performance, Accessibility, Best Practices, SEO) nas rotas-chave, mobile e desktop | 100 nas quatro (mediana de 3 execuções, protocolo em [performance-budgets](../quality/performance-budgets.md)) |
| Experiência real | Core Web Vitals no p75 (campo) | LCP ≤ 2,5 s · INP ≤ 200 ms · CLS ≤ 0,1 |
| Acessibilidade | Violações axe sérias ou críticas | 0 em todos os templates |
| Agilidade editorial | Tempo entre publicar e a página aparecer atualizada | ≤ 60 s; agendamento executado em até 5 min após o horário |
| Cobertura multilíngue | Conteúdo publicado com tradução revisada nos 4 idiomas | 100% (com visibilidade de desatualizadas no dashboard) |
| Custo | Gasto mensal com infraestrutura e IA | US$ 0 no plano Free (o domínio é a única despesa prevista e depende de sua aprovação) |

## 4. Personas

| ID | Persona | Necessidade principal |
|---|---|---|
| P1 | Recrutador / gestor técnico | Avaliar competências e resultados em poucos minutos, muitas vezes no celular e em inglês ou alemão |
| P2 | Cliente potencial | Entender o que você resolve, ver estudos de caso e entrar em contato |
| P3 | Leitor técnico | Ler artigos com código, rápido e sem distrações; assinar o RSS |
| P4 | Owner (você) | Escrever em pt-BR, publicar, agendar, revisar traduções e controlar custos |
| P5 | Futuro editor / tradutor | Atuar com permissões limitadas (modelo pronto, interface futura) |

## 5. Escopo

**Dentro da v1:** todos os requisitos RF-01…RF-12, RX-01…RX-05 e RNF-01…RNF-13 abaixo.

**Fora da v1 (backlog):** comentários; newsletter; busca no site (candidata a índice estático); interface completa de gestão de múltiplos usuários e convites (o modelo de dados e o RBAC já suportam); edição colaborativa em tempo real; analytics de terceiros.

## 6. Requisitos funcionais

Prioridade MoSCoW: **M** = must, **S** = should, **C** = could, **W** = won't (v1).

### RF-01 — Site público com home, sobre, projetos, blog e contato

| ID | Requisito | Prio |
|---|---|---|
| RF-01.1 | Home com apresentação, destaques de projetos e artigos e chamada para contato | M |
| RF-01.2 | Página Sobre: bio, trajetória, competências e links | M |
| RF-01.3 | Projetos: listagem e página de estudo de caso | M |
| RF-01.4 | Blog: listagem paginada, filtro por tema e página de artigo com sumário e tempo de leitura | M |
| RF-01.5 | Artigos relacionados no fim do artigo | S |
| RF-01.6 | Contato: formulário protegido (Turnstile + rate limit) e links diretos | M |
| RF-01.7 | Página de privacidade (LGPD/GDPR) | M |
| RF-01.8 | Páginas 404 e 500 localizadas | M |
| RF-01.9 | Feed RSS por idioma | S |

### RF-02 — Painel administrativo protegido

| ID | Requisito | Prio |
|---|---|---|
| RF-02.1 | `/admin` acessível só com sessão válida; toda ação autorizada no servidor | M |
| RF-02.2 | Admin fora do índice (noindex) e nunca em cache público | M |
| RF-02.3 | Dashboard: rascunhos, agendados, traduções pendentes ou desatualizadas, uso de IA no mês | S |
| RF-02.4 | Log de auditoria consultável (quem, o quê, quando) | S |

### RF-03 — Um administrador hoje; múltiplos usuários e permissões no futuro

| ID | Requisito | Prio |
|---|---|---|
| RF-03.1 | Owner inicial criado por bootstrap de uso único | M |
| RF-03.2 | Login por passkey; GitHub OAuth restrito ao ID do owner como recuperação | M |
| RF-03.3 | Sem cadastro público | M |
| RF-03.4 | RBAC por `recurso:ação` com papéis (owner, admin, editor, author, translator, viewer) aplicado no servidor | M |
| RF-03.5 | Listar e revogar sessões ativas | S |
| RF-03.6 | Convites e gestão de usuários pela interface | W (modelo pronto) |

### RF-04 — Editor visual de artigos e projetos

| ID | Requisito | Prio |
|---|---|---|
| RF-04.1 | Texto rico: títulos, parágrafos, listas, citações, ênfases, links | M |
| RF-04.2 | Imagens da biblioteca com alt e legenda; galerias | M |
| RF-04.3 | Vídeo: upload próprio com poster e legendas (WebVTT) ou embed permitido | M |
| RF-04.4 | Blocos de código com linguagem e destaque de sintaxe | M |
| RF-04.5 | Embeds seguros (lista fechada de provedores, facade, sandbox) | M |
| RF-04.6 | Callouts, divisores e tabelas simples | S |
| RF-04.7 | Autosave, contagem de palavras e tempo de leitura | M |
| RF-04.8 | Arrastar blocos e atalhos de teclado acessíveis | S |

### RF-05 — Rascunhos, agendamento, preview, publicação, versões e restauração

| ID | Requisito | Prio |
|---|---|---|
| RF-05.1 | Rascunho independente da versão publicada | M |
| RF-05.2 | Agendamento por data e hora (com fuso) | M |
| RF-05.3 | Preview autenticado e link temporário de preview | M |
| RF-05.4 | Publicar e despublicar | M |
| RF-05.5 | Histórico de versões com diff | M |
| RF-05.6 | Restaurar uma versão (gera nova revisão, nunca apaga histórico) | M |
| RF-05.7 | Atualização automática do cache, sitemap e RSS após publicar | M |

### RF-06 — Upload e gerenciamento de mídias

| ID | Requisito | Prio |
|---|---|---|
| RF-06.1 | Upload de imagens (JPEG, PNG, WebP, AVIF) com validação de tipo, tamanho e dimensões | M |
| RF-06.2 | Variantes responsivas (AVIF, WebP, JPEG) e placeholder | M |
| RF-06.3 | Biblioteca com busca, filtros e metadados por idioma (alt, legenda, crédito) | M |
| RF-06.4 | Upload de vídeo (MP4, WebM) com poster e legendas | S |
| RF-06.5 | Ponto de foco para recortes | S |
| RF-06.6 | Exclusão bloqueada para mídia em uso | M |

### RF-07 — SEO personalizável por página

| ID | Requisito | Prio |
|---|---|---|
| RF-07.1 | Título e descrição SEO por idioma, com prévia do resultado de busca | M |
| RF-07.2 | Imagem Open Graph por idioma (gerada ou escolhida) | M |
| RF-07.3 | Slug editável com redirect 301 automático | M |
| RF-07.4 | `noindex` por página | S |

### RF-08 — Configurações globais editáveis

| ID | Requisito | Prio |
|---|---|---|
| RF-08.1 | Identidade (nome, cargo, bio curta) por idioma | M |
| RF-08.2 | Redes sociais e e-mail de contato | M |
| RF-08.3 | SEO padrão (modelo de título, descrição, imagem OG padrão) por idioma | M |
| RF-08.4 | Navegação e rodapé | S |
| RF-08.5 | Provedor, modelo e orçamento de IA | M |
| RF-08.6 | Flags operacionais (por exemplo, analytics ligado ou desligado) | C |

### RF-09 — Projetos com estudos de caso

| ID | Requisito | Prio |
|---|---|---|
| RF-09.1 | Campos: título, resumo, papel, período, contexto, desafio, solução, resultados verificáveis, tecnologias, galeria, links GitHub e demo | M |
| RF-09.2 | Ordenação manual e destaque na home | M |
| RF-09.3 | Filtro por tecnologia | S |
| RF-09.4 | Projetos relacionados | C |

### RF-10 — pt-BR original com traduções para en, es, de e fr

| ID | Requisito | Prio |
|---|---|---|
| RF-10.1 | pt-BR é o idioma original e padrão (sem prefixo na URL) | M |
| RF-10.2 | Interface e conteúdo em en, es, de e fr | M |
| RF-10.3 | Seletor de idioma leva à página equivalente (ou à home do idioma, se não houver tradução) | M |
| RF-10.4 | Artigos, projetos e temas sem tradução aprovada não aparecem naquele idioma. Páginas institucionais sem tradução mostram o original com aviso e `noindex` | M |
| RF-10.5 | Datas e números formatados por idioma | M |

### RF-11 — Tradução assistida por IA com revisão humana

| ID | Requisito | Prio |
|---|---|---|
| RF-11.1 | Gerar rascunho de tradução por idioma para artigos, projetos, páginas, configurações e textos de mídia | M |
| RF-11.2 | Revisão humana obrigatória antes de publicar | M |
| RF-11.3 | Estimativa de custo antes de executar; teto mensal e por job | M |
| RF-11.4 | Detecção de tradução desatualizada, por segmento | M |
| RF-11.5 | Tradução de slug e campos de SEO | M |
| RF-11.6 | Glossário e termos protegidos (nomes, marcas, código) | S |
| RF-11.7 | Retraduzir só os segmentos alterados | S |

As strings de interface (`i18n/locales/*.json`) vivem no repositório e são mantidas nas tarefas de código. O fluxo de IA do CMS cobre o conteúdo editorial.

### RF-12 — URLs localizadas, canonical, hreflang, sitemap, Open Graph e JSON-LD

| ID | Requisito | Prio |
|---|---|---|
| RF-12.1 | Rotas e slugs traduzidos | M |
| RF-12.2 | `canonical` por idioma | M |
| RF-12.3 | `hreflang` recíproco, com `x-default`, só para idiomas publicados | M |
| RF-12.4 | Sitemap com alternates e `lastmod` | M |
| RF-12.5 | Open Graph e Twitter cards por idioma | M |
| RF-12.6 | JSON-LD: Person/ProfilePage, WebSite, BlogPosting, CreativeWork, BreadcrumbList | M |
| RF-12.7 | `robots.txt` por ambiente (preview sempre `noindex`) | M |

## 7. Requisitos de experiência

| ID | Requisito |
|---|---|
| RX-01 | Design editorial premium: tipografia marcante, grid editorial, layouts sofisticados e identidade própria, sem template genérico |
| RX-02 | Home cinematográfica: scroll storytelling, animações baseadas em scroll, microinterações e transições de página |
| RX-03 | Efeitos SVG e 3D só quando agregarem valor, com justificativa no storyboard |
| RX-04 | Leitura do blog simples, rápida e acessível: layout de leitura, tipografia legível, sem animações intrusivas |
| RX-05 | Toda animação tem estratégia responsiva, fallback e respeito a `prefers-reduced-motion` |

## 8. Requisitos não funcionais

| ID | Requisito | Verificação |
|---|---|---|
| RNF-01 | Lighthouse 100 nas quatro categorias nas rotas-chave, reconhecendo a variação de medição | Lighthouse 13, protocolo e tolerância em [performance-budgets](../quality/performance-budgets.md) |
| RNF-02 | Core Web Vitals no p75: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 | Laboratório na F11; campo após o lançamento |
| RNF-03 | JavaScript mínimo nas páginas públicas | Orçamentos por rota checados no CI |
| RNF-04 | HTML renderizado no servidor; conteúdo completo sem JS | Teste E2E com JS desligado nas rotas públicas |
| RNF-05 | Cache eficiente na borda com invalidação após publicação | Teste de purge por tag; ≤ 60 s para refletir |
| RNF-06 | Toda ação administrativa autenticada, autorizada e validada no servidor | Testes da matriz de autorização |
| RNF-07 | Autenticação segura; proteção contra CSRF e XSS; rate limiting; validação de uploads | `/security-audit` + testes de segurança |
| RNF-08 | Custo: plano gratuito; nenhum serviço ou dependência paga sem aprovação; IA com teto | Revisão de dependências por ADR; ledger de IA |
| RNF-09 | Código modular, tipado (strict) e testável | Typecheck, lint e cobertura dos módulos críticos |
| RNF-10 | Acessibilidade WCAG 2.2 AA | axe + checklist manual ([accessibility](../quality/accessibility.md)) |
| RNF-11 | Excelente experiência mobile (a partir de 360 px, toque, dispositivos medianos) | QA visual e Lighthouse mobile |
| RNF-12 | Privacidade LGPD/GDPR: sem rastreamento sem consentimento, retenção definida, IP com hash | Revisão de privacidade no `/release-check` |
| RNF-13 | Operação: backups, restore ensaiado, observabilidade e rollback | Runbooks em [operations](../operations/) e ensaio na F12 |

## 9. Arquitetura de informação

| Página | pt-BR | en | es | de | fr |
|---|---|---|---|---|---|
| Home | `/` | `/en` | `/es` | `/de` | `/fr` |
| Sobre | `/sobre` | `/en/about` | `/es/sobre-mi` | `/de/ueber-mich` | `/fr/a-propos` |
| Projetos | `/projetos` | `/en/projects` | `/es/proyectos` | `/de/projekte` | `/fr/projets` |
| Estudo de caso | `/projetos/{slug}` | `/en/projects/{slug}` | `/es/proyectos/{slug}` | `/de/projekte/{slug}` | `/fr/projets/{slug}` |
| Blog | `/blog` | `/en/blog` | `/es/blog` | `/de/blog` | `/fr/blog` |
| Artigo | `/blog/{slug}` | `/en/blog/{slug}` | `/es/blog/{slug}` | `/de/blog/{slug}` | `/fr/blog/{slug}` |
| Tema | `/blog/temas/{slug}` | `/en/blog/topics/{slug}` | `/es/blog/temas/{slug}` | `/de/blog/themen/{slug}` | `/fr/blog/sujets/{slug}` |
| Contato | `/contato` | `/en/contact` | `/es/contacto` | `/de/kontakt` | `/fr/contact` |
| Privacidade | `/privacidade` | `/en/privacy` | `/es/privacidad` | `/de/datenschutz` | `/fr/confidentialite` |
| RSS | `/rss.xml` | `/en/rss.xml` | `/es/rss.xml` | `/de/rss.xml` | `/fr/rss.xml` |

Rotas sem idioma: `/sitemap.xml` (índice), `/robots.txt`, `/admin/**` (interface em pt-BR, não indexada) e `/preview/{token}` (não indexada). Detalhes em [i18n-seo](../architecture/i18n-seo.md).

## 10. Jornadas principais

| ID | Jornada | Requisitos |
|---|---|---|
| J-01 | Visitante chega à home, explora um estudo de caso e envia uma mensagem | RF-01, RF-09, RX-02 |
| J-02 | Leitor encontra um artigo pela busca em alemão, lê e troca para inglês | RF-10, RF-12, RX-04 |
| J-03 | Owner cria um artigo, insere imagens e código, faz preview e agenda | RF-04, RF-05, RF-06 |
| J-04 | A publicação agendada dispara: cache, sitemap e RSS são atualizados | RF-05.7, RNF-05 |
| J-05 | Owner gera traduções por IA, revisa lado a lado, aprova e publica por idioma | RF-11 |
| J-06 | Owner edita o original; as traduções ficam desatualizadas e só os segmentos alterados são retraduzidos | RF-11.4, RF-11.7 |
| J-07 | Owner restaura uma versão anterior de um artigo | RF-05.5, RF-05.6 |
| J-08 | Owner perde a passkey, entra pelo GitHub e registra uma nova | RF-03.2 |

## 11. Premissas e restrições

- Plano Free da Cloudflare, com gate de medição na F00. Upgrade só com evidência e aprovação ([ADR-0003](../architecture/adr/0003-renderizacao-cache-e-cpu.md)).
- Login sem senha: passkey + GitHub OAuth restrito ([ADR-0005](../architecture/adr/0005-autenticacao-e-rbac.md)).
- Tradução por Workers AI; Claude é opção futura com aprovação ([ADR-0009](../architecture/adr/0009-traducao-assistida-por-ia.md)).
- Domínio próprio na Cloudflare até o lançamento; preview em `workers.dev`.
- Volume esperado no 1º ano: até ~100 artigos, ~30 projetos e tráfego abaixo de 100 mil requisições por dia.
- Nenhum conteúdo biográfico, métrica, cliente ou depoimento é inventado; placeholders ficam marcados como tal.

## 12. Riscos

| Risco | Resposta |
|---|---|
| SSR acima de 10 ms de CPU no Free | Spike F00-T6; Paid com aprovação ou pré-render |
| Workers Cache indisponível no Free ou contando assets no limite | Cache API com purge por tag; assets em outra origem |
| Ambição de motion derruba performance ou clareza | Storyboard aprovado, motion carregado após o LCP, versão reduzida |
| Qualidade da tradução automática | Revisão humana obrigatória; glossário; Claude como opção |
| Nota 100 instável entre execuções | Protocolo com mediana e tolerância; CWV de campo |
| Versões fixadas (TS 6, Vitest 4.1) envelhecem | Revisão trimestral ([ADR-0002](../architecture/adr/0002-plataforma-e-toolchain.md)) |

## 13. Insumos pendentes

| ID | Pergunta | Necessário até |
|---|---|---|
| Q-01 | Domínio (e aprovação do custo de registro) | F12 |
| Q-02 | 2–3 referências visuais ou moodboard | F01-T1 |
| Q-03 | Tema claro, escuro ou ambos (e qual é o padrão) | F01-T1 |
| Q-04 | Conteúdo real: bio, foto, projetos, artigos iniciais | F06 / F07 |
| Q-05 | E-mail de contato verificado no Email Routing | F08-T3 |
| Q-06 | Fuso horário padrão para agendamentos | F06-T4 |
| Q-07 | Repositório público ou privado (afeta minutos de CI) | F00-T5 |
| Q-08 | Analytics: nenhum ou Cloudflare Web Analytics (sem cookies) | F12 |

## 14. Glossário

- **Owner:** usuário com todas as permissões; inicialmente o único.
- **Localização:** a versão de uma entidade em um idioma (linha em `*_localizations`).
- **Revisão:** cópia imutável de uma localização num momento (autosave, manual, publicação, restauração ou IA).
- **Segmento:** unidade traduzível de um documento, identificada por um ID estável de nó.
- **Gate:** critério que precisa ser cumprido para a fase seguinte começar.
- **Spike:** experimento curto para validar uma hipótese técnica antes de decidir.
- **Cache-Tag / purge:** etiqueta de cache por entidade e idioma; purge é a invalidação dessas entradas.
- **Facade:** imagem estática no lugar de um embed pesado, carregado só ao interagir.
