# Modelo de ameaças — perguntas por superfície

Versão completa: `docs/architecture/security-model.md`. Use estas perguntas para guiar a revisão de cada superfície tocada.

| Superfície | Perguntas que a auditoria responde |
|---|---|
| Páginas públicas | Algum dado não publicado chega ao HTML ou ao payload? Algum input do usuário é renderizado sem escape? Alguma resposta emite `Set-Cookie`? |
| `/api/public/contact` | Dá para enviar sem Turnstile? Dá para abusar da cota (rate limit, honeypot)? A resposta reflete a entrada? Dado pessoal vai para log? |
| `/api/auth/*` | Um ID do GitHub fora da allowlist cria usuário? Há enumeração de usuários? Há rate limit? Os cookies estão com as flags certas? |
| `/admin/setup` | É acessível com owner existente? O token é comparado em tempo constante? O token fica em log? |
| `/api/admin/*` | Existe rota sem `defineAdminHandler`? `author` consegue agir em recurso alheio (IDOR)? Uma mutação cross-origin passa? O input é `strict`? |
| Upload | Um arquivo com extensão falsa passa? Um SVG passa? O usuário controla a chave do R2? O tamanho é limitado antes de gravar? |
| Editor e renderer | Um nó ou atributo desconhecido passa pela validação? `javascript:` em link? HAST com `onerror`? Embed fora da lista? |
| Preview | O token expira? Pode ser adulterado ou reaproveitado para outra entidade? A resposta é cacheada ou indexada? |
| Tradução por IA | A saída do modelo é tratada como dado? Pode quebrar o documento? Dado pessoal vai no payload? O teto de custo é verificado antes? |
| Cron | É idempotente? Um item com problema bloqueia os outros? Respeita o limite de CPU? |
| CI/CD | Segredos expostos em logs? O token tem escopo mínimo? Existe deploy automático de produção (proibido)? |

## Padrões de exploração a testar

- **CSRF:** `fetch('https://site/api/admin/articles', { method: 'POST', credentials: 'include' })` vindo de outra origem → 403.
- **IDOR:** um `author` com o ID de um artigo de outro autor em PATCH → 403.
- **XSS armazenado:** um título `"><img src=x onerror=alert(1)>` → texto escapado no público e no admin.
- **Polyglot:** um JPEG válido com HTML ou JS anexado → aceito só como imagem, servido com `nosniff`, nunca como `text/html`.
- **Bootstrap:** POST no setup com token correto e owner já existente → 404.
