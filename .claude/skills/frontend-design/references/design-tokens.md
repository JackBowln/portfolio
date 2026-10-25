# Tokens de design — organização e convenções

Os valores finais são definidos na F01-T2, em `app/assets/css/main.css` (`@theme`) e espelhados em `shared/design/tokens.ts` (só o que o JS usa).

## Grupos e nomes

| Grupo | Prefixo Tailwind 4 (`@theme`) | Exemplos | Regra |
|---|---|---|---|
| Cor (semântica) | `--color-*` | `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-accent`, `--color-accent-contrast`, `--color-focus`, `--color-success`, `--color-warning`, `--color-danger` | Componentes usam só os **semânticos**; a paleta bruta (`--color-neutral-50…950`, `--color-accent-*`) só alimenta os semânticos |
| Tema | `[data-theme="dark"]` sobrescreve os semânticos | — | Nada de `dark:` espalhado: o tema troca as variáveis |
| Tipografia | `--font-display`, `--font-sans`, `--font-mono`; `--text-*` (escala) | `--text-step--1` … `--text-step-7` | Tamanhos com `clamp()`; cada passo tem `line-height` e `letter-spacing` associados |
| Espaço | `--spacing` (base 4 px) + fluidos | `--space-section`, `--space-gutter` | Seções usam os fluidos; componentes usam a escala base |
| Layout | `--container-*`, `--breakpoint-*` | `--container-reading: 68ch`, `--container-max: 1440px` | Breakpoints: 640, 768, 1024, 1280, 1536 |
| Forma | `--radius-*`, `--shadow-*` | `--radius-sm/md/lg`, `--shadow-raised` | Sombras mínimas; editorial usa linhas (hairlines) |
| Camadas | `--z-*` | `--z-header`, `--z-overlay`, `--z-toast` | Nunca `z-index` numérico solto |
| Motion | `--dur-*`, `--ease-*` | ver `docs/design/motion-principles.md` §2 | O GSAP lê do espelho TS |

## Regras para adicionar um token

1. Ele expressa uma **decisão** reutilizável (não um caso único).
2. Nome semântico pelo papel, não pelo valor (`--color-accent`, e não `--color-red`).
3. Contraste conferido com `pnpm check:contrast` quando for cor de texto ou UI.
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
