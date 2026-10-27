# Tokens de design — organização e convenções

Os valores finais estão em `app/assets/css/main.css` (`@theme static`, desde a F01-T2) e espelhados em `shared/design/tokens.ts` (motion, breakpoints e escala, que o JS usa). Decisões no ADR-0010, "Decisões da F01-T2".

## Grupos e nomes

| Grupo | Prefixo Tailwind 4 (`@theme`) | Exemplos | Regra |
|---|---|---|---|
| Cor (semântica) | `--color-*` | `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-accent`, `--color-accent-contrast`, `--color-focus`, `--color-success`, `--color-warning`, `--color-danger` | Componentes usam só os **semânticos** (inclui os de estado `accent-hover`, `accent-active` e `surface-active`); a paleta bruta (`--color-night-50…950`, `--color-paper-*`, `--color-rose-*`, `--color-green/amber/red-*`) só alimenta os semânticos |
| Tema | Semânticos em `light-dark(<claro>, <escuro>)`; `color-scheme` (sistema ou `[data-theme]`) escolhe o lado | — | Nada de `dark:` espalhado. Para fixar um trecho num tema, use `color-scheme` nele |
| Tipografia | `--font-display`, `--font-sans`, `--font-mono`; `--text-*` (escala) | `--text-step--1` … `--text-step-7` (utilitários `text-step-N`) | Tamanhos com `clamp()`; cada passo tem `--text-step-N--line-height`, e os de display (3+) `--letter-spacing` |
| Espaço | `--spacing` (base 4 px) + fluidos | `--spacing-section`, `--spacing-gutter` (`py-section`, `px-gutter`) | Seções usam os fluidos; componentes usam a escala base |
| Layout | `--container-*`, `--breakpoint-*` | `--container-reading: 68ch`, `--container-max: 1440px` | Breakpoints: 640, 768, 1024, 1280, 1536 |
| Forma | `--radius-*`, `--shadow-*` | `--radius-control/card/chip` (0: cantos retos), `--radius-full`, `--shadow-raised` | Sombras mínimas; editorial usa linhas (hairlines) |
| Camadas | `--z-*` | `--z-header`, `--z-overlay`, `--z-toast` (em `:root`; `z-(--z-header)`) | Nunca `z-index` numérico solto |
| Motion | `--dur-*`, `--ease-*` | ver `docs/design/motion-principles.md` §2 | O GSAP lê do espelho TS |

## Regras para adicionar um token

1. Ele expressa uma **decisão** reutilizável (não um caso único).
2. Nome semântico pelo papel, não pelo valor (`--color-accent`, e não `--color-red`).
3. Contraste conferido com `pnpm check:contrast` quando for cor de texto ou UI (novo par de uso → acrescente em `CONTRAST_PAIRS`, `shared/design/contrast.ts`).
4. Documentado na styleguide de dev.

## Contraste (alvos)

| Par | Mínimo |
|---|---|
| `text` × `bg`/`surface` | 4,5:1 (desejável 7:1) |
| `text-muted` × `bg`/`surface` | 4,5:1 |
| `accent` como texto × `bg` | 4,5:1 |
| `accent-contrast` × `accent` (botão) | 4,5:1 |
| `focus` × `bg` adjacente | 3:1 |
| `border` informativo × `bg` | 3:1 |
