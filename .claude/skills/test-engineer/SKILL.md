---
name: test-engineer
description: Cria e corrige testes deste portfólio — unitários e de componente (Vitest 4.1 + @nuxt/test-utils), integração com D1/R2 reais (@cloudflare/vitest-pool-workers), API e E2E (Playwright contra o build em wrangler dev, com passkey via autenticador WebAuthn virtual), acessibilidade (axe) e visuais — seguindo a estratégia do projeto e relatando sempre a saída real. Use ao implementar qualquer tarefa que precise de testes, ao corrigir bugs (teste que falha primeiro), ao investigar testes instáveis ou ao configurar a infraestrutura de testes.
when_to_use: "Gatilhos: 'teste', 'testar', 'cobertura', 'Vitest', 'Playwright', 'E2E', 'axe', 'acessibilidade automatizada', 'teste falhando', 'flaky', 'mock', 'fixture', 'regressão', 'TDD'."
argument-hint: "[arquivo | módulo | jornada J-0x]"
---

# Test Engineer

Fontes:
- `docs/quality/test-strategy.md` (camadas, casos obrigatórios por domínio, mocks, cobertura);
- `docs/architecture/adr/0013-testes-e-qualidade.md`;
- [references/test-matrix.md](references/test-matrix.md) (onde cada teste vive);
- [references/patterns.md](references/patterns.md) (padrões de código).

## Regras

1. **Teste no nível certo**, o mais baixo que prova o comportamento (unit → componente → workers → api → e2e). Veja a [matriz](references/test-matrix.md).
2. **Comportamento, não implementação.** Nomes em inglês (`it('rejects unknown nodes')`).
3. **Bug = teste vermelho primeiro**, depois a correção.
4. **Determinismo:**
   - relógio falso (`vi.useFakeTimers`) para datas e agendamento;
   - factories com IDs e datas fixos;
   - nada de `sleep`: espere por estado;
   - **nenhuma** chamada real a terceiros (IA, GitHub, Turnstile): use o `FakeTranslationProvider`, o mock do OAuth e as chaves de teste do Turnstile.
5. **Segurança e acessibilidade são testes de primeira classe:** matriz de autorização gerada de `permissions.ts`, meta-teste de rotas do admin e axe com tags WCAG 2.2 AA (0 violações sérias ou críticas).
6. **Login de teste só em build de teste** (`TEST_AUTH=1` + `ENVIRONMENT=test`); nunca no build normal.
7. **Instável não se apaga:** corrija ou marque `fixme` com issue e prazo, e declare no relatório.
8. **Nunca declare aprovado sem executar.** Cole o comando e o resumo (passou/falhou/pulado, duração).

## Procedimento

1. Leia os critérios de aceite e a seção "Testes" da tarefa; liste os casos (felizes, de borda, maliciosos).
2. Escolha a camada de cada caso pela matriz e reutilize as factories e helpers de `tests/`.
3. Escreva os testes, rode e veja falhar quando a funcionalidade ainda não existe (ou provar o bug).
4. Depois da implementação: rode o projeto afetado e, antes de concluir, a suíte relevante completa.
5. Confira a cobertura dos módulos críticos (≥ 90% de branches) quando forem tocados.

## Comandos

`pnpm test` · `pnpm test:unit` · `pnpm test:nuxt` · `pnpm test:workers` · `pnpm test:api` · `pnpm test:e2e` · `pnpm test:a11y` · `pnpm test:visual` · `pnpm test:seed`

## Relatório

```markdown
**Testes** — <tarefa>
- Novos: <arquivo> (<n> casos: felizes/borda/maliciosos)
- `pnpm test:unit` → 58 passed, 0 failed (1.9s)
- `pnpm test:api` → 22 passed, 0 failed
- Cobertura (módulos críticos tocados): permissions.ts 96% branches
- Instáveis ou pulados: nenhum | <lista com motivo e issue>
```
