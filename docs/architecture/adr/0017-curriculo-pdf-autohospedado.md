# ADR-0017 — Currículo em PDF, autohospedado na mídia

- **Status:** Proposto (2026-11-25), aguardando revisão do owner dos cabeçalhos de entrega (§4)
- **Decisores:** Owner · Claude Code
- **Relacionados:** ADR-0007 (mídia), ADR-0012 (segurança), F13-T5, decisão D-08 do [plano de implementação](../../implementation-plan.md)

## Contexto

- A home do site de referência tem um botão "Baixar CV". Para o portfólio, o CV precisa ser um arquivo que o owner controla, não um link externo.
- O pipeline de mídia aceita só imagens (JPEG, PNG, WebP, AVIF) e vídeo (MP4, WebM). O enum `MEDIA_KINDS` tem `file`, mas nenhum código o usa (grep em 2026-11-25).
- Um PDF é um formato com conteúdo ativo: pode conter JavaScript, formulários e links. Servido inline no domínio do site, um PDF malicioso roda no contexto de origem. Por isso o ADR trata a entrega com mais cuidado que a de imagens.
- O pipeline do ADR-0007 gera variantes no navegador do admin. Um PDF não tem variantes, e o Worker não processa conteúdo (limite de 10 ms de CPU).

## Decisão

1. **Tipo de mídia `file`, só para PDF.**
   - MIME `application/pdf`, magic bytes `%PDF-` no primeiro chunk (mesma regra das imagens, ADR-0007 §3).
   - Limite de 5 MB por arquivo (bytes decimais). Um currículo maior não é currículo.
   - Um original, sem variantes e sem processamento no navegador. O `sha256` segue a regra do ADR-0007 (declarado, único, sem recálculo no Worker).
2. **Armazenamento.**
   - A chave segue o padrão do ADR-0007: `originals/{sha256}.pdf`. O nome nunca vem do usuário.
   - O original não é servido por nenhum outro caminho.
3. **Entrega.**
   - A URL é a mesma das mídias (`MEDIA_BASE_URL`, rota `server/routes/media/[...key].ts` em preview e local).
   - Cabeçalhos próprios para `file`, diferentes da imagem:
     - `Content-Type: application/pdf` vindo do registro, nunca da extensão;
     - `Content-Disposition: attachment; filename="cv.pdf"`, para o navegador baixar em vez de renderizar;
     - `Content-Security-Policy: default-src 'none'; sandbox`, para que, se o arquivo for aberto mesmo assim, não rode script nem carregue nada;
     - `X-Content-Type-Options: nosniff`;
     - `Cache-Control: public, max-age=86400` (um dia, não o `immutable` das imagens: a troca de arquivo deve aparecer em um dia, e a URL muda com o `sha256` de qualquer forma).
4. **Uso.** O CV é referenciado pelas configurações globais de identidade (`identity.global.cvMediaId`, F13-T1 o deixou fora da tradução). A referência conta como uso (`media_usages`), então o arquivo em uso não pode ser apagado (409, ADR-0007 §8). Hoje as configurações não gravam `media_usages`: a correção entra nesta mesma mudança, para o CV e para a imagem OG.
5. **Admin.** Um uploader de PDF simples (escolher arquivo, enviar, aguardar `ready`), sem o pipeline de imagem. A tela de mídia lista o arquivo com o nome e o tamanho; a seleção nas configurações aceita só arquivos `file` prontos.

## Alternativas consideradas

- **Link externo** (um CV hospedado pelo owner em outro lugar): zero código, mas o owner não controla o arquivo nem a disponibilidade. Recusado pelo owner (D-08).
- **Exibir o PDF inline no site** (`Content-Disposition: inline` e um visualizador): aumenta a superfície de ataque do PDF no domínio do site. Recusado.
- **Converter o PDF em HTML no servidor**: CPU e fidelidade fora de alcance no Free, e não é o que o owner pediu. Recusado.
- **Usar um serviço pago de armazenamento**: fora do custo zero (CLAUDE.md, "Sem custo novo"). Recusado.

## Consequências

- Os 44 pontos que tratam `kind` precisam ser revistos para `file` (manifesto, plano de upload, finalização, mapeamento público, admin). Cada um recebe teste.
- O cron de limpeza de objetos sem uso (ADR-0007 §8) passa a cobrir os PDFs.
- O CV pode ser atualizado sem deploy. A URL muda a cada versão, então o cache do navegador não serve um CV antigo por mais de um dia.
- Risco residual: um PDF válido ainda pode conter conteúdo enganoso (um texto que parece outra pessoa). A mitigação é o owner ser quem envia o próprio arquivo; o site não verifica o conteúdo do PDF.

## Verificação prevista (F13-T5)

- Teste unitário: MIME e magic bytes; arquivo que começa com `%PDF-` mas tem MIME de imagem é recusado; limite de 5 MB.
- Teste do worker: os cabeçalhos da §3 em uma resposta real de `file`.
- Teste de uso: CV em uso não pode ser apagado; a troca de CV libera o uso antigo.
- Navegador: o botão de download baixa o arquivo e a aba não renderiza PDF.
