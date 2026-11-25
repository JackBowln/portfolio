# Implementation plan — combining Website A (function) and Website B (motion)

**Status:** proposed, **awaiting approval** (CLAUDE.md, workflow step 2). No application code was changed in this pass.
**Inputs:** [website-a-functional-analysis.md](research/website-a-functional-analysis.md), [website-b-motion-analysis.md](research/website-b-motion-analysis.md), [animation-mapping.md](animation-mapping.md).
**Language:** written in English at the owner's request. CLAUDE.md asks for pt-BR docs; see decision D-06.

---

## 0. Repository assessment

### 0.1 Target

| Item | Finding | Verified |
|---|---|---|
| Location | `/Users/viniciusvioladias/Desktop/dev/portfolio` (the parent folder `dev/` is not a repo and holds unrelated projects) | [V] |
| Existing application | Yes: **Nuxt 4 + Cloudflare** portfolio and blog with an admin CMS. Preserved; no framework migration | [V] |
| Git | Branch `chore/F12-T5-launch`, HEAD `cec4015` | [V] |
| Uncommitted changes | `nuxt.config.ts`: a **formatting-only diff** (quote style, semicolons, line wrapping), not made in this pass. Untracked `.agents/` and `.vscode/`. **Left untouched**; the docs commit stages only the new docs | [V] |
| Roadmap | F00–F11 complete in code; F12-T5 is the next task | [V] |

### 0.2 Stack (as installed)

| Layer | Version / detail | Verified |
|---|---|---|
| Runtime | Node 24.22.1 (engine `^24.15.0`), pnpm 10.34.8 | [V] |
| Framework | Nuxt `~4.6`, Vue `~3.5`, vue-router `~5.4`, TypeScript `~6.0` | [V] (package.json) |
| Styling | Tailwind `~4.3` via `@tailwindcss/vite` | [V] |
| Motion | GSAP `~3.15`, loaded on demand (`app/composables/motion/**`); CSS View Transitions on | [V] |
| Data / auth | D1 + Drizzle (`~0.45`), Better Auth `~1.7` with passkey and GitHub | [V] |
| Content | Tiptap `~3.32` (admin only), Shiki `~4.5` (admin only) | [V] |
| Hosting | Cloudflare Workers with Static Assets, R2 for media, Workers AI for translation | [V] |
| Tests | Vitest `~5.0`, Playwright `~1.64`, axe `~4.14`, Lighthouse `13` | [V] (package.json) |

### 0.3 Existing functionality to preserve

| Area | Existing (routes and features) | Verified |
|---|---|---|
| Public pages | Home (`/`), about (`/sobre`), contact (`/contato`), privacy (`/privacidade`), blog (`/blog`, `/blog/[slug]`, `/blog/temas/[slug]`), projects (`/projetos`, `/projetos/[slug]`), preview (`/preview/[token]`), error pages | [V] (`app/pages`) |
| Admin | Login, setup, dashboard, articles, projects, media, pages, settings, translations, messages, audit log, passkeys, sessions | [V] (`app/pages/admin`) |
| Contact | Real form with Turnstile and rate limit, inbox in admin, 12-month retention | [V] (docs, CLAUDE.md) |
| i18n | pt-BR (default), en, es, de, fr with translated routes and hreflang | [V] |
| Motion | `director.ts` (idle-loaded GSAP), `scenes/home.ts` (opening, pinned story, project reveals, closing magnetic CTA), `scenes/case-study.ts`, `scenes/count.ts`, reduced-motion preference, `shared/design/motion.ts` | [V] |
| Docs | PRD, 16 ADRs, architecture overview, data model, security model, i18n/SEO, quality, operations, roadmap F00–F12, storyboard, motion principles | [V] |
| Skills | `architecture-guardian`, `cms-engineer`, `frontend-design`, `i18n-manager`, `motion-engineer`, `performance-audit`, `release-check`, `security-audit`, `test-engineer` | [V] |

### 0.4 Gap analysis: Website A features × portfolio

| A feature | Portfolio today | Gap | Verified |
|---|---|---|---|
| Hero with CTAs | Home hero blocks (eyebrow, title, subtitle, CTA) exist | Matches; CTA set may differ | [V] (storyboard) |
| Stats strip (4 figures) | Highlights exist for projects (`count` scene); no home stats strip | **Missing** on home | [V] (grep, scene file) |
| Experience (6 roles) | No experience content type or section | **Missing** | [V] (grep: 0 matches) |
| GitHub-style projects | Projects with case studies, filter, ordering, publication | **Covered**, and richer | [V] |
| Skills & background | Only a technology filter on projects | **Missing** as a section | [V] (partial match) |
| AI Outreach drafter | None | **Missing** | [V] (grep: 0 matches) |
| Blog and articles | Full: list, article, topics, RSS | **Covered** | [V] |
| Contact | Real form, Turnstile, inbox | **Covered**, stronger than A (A has no form) | [V] |
| CV download | No route or asset linked from the header/hero | **Missing** (needs the PDF in media) | [V] (grep: no match in routes) |
| 404 | `app/error.vue` | **Covered** | [V] |
| Analytics beacon | Not needed | Not required | — |

### 0.5 Tools used and their limits

| Tool | Used for | Limit | Verified |
|---|---|---|---|
| Playwright (`@playwright/test` 1.64, Chromium installed locally) | Screenshots, DOM, network, reduced-motion checks, flows | Headless with **software WebGL**: frame rates and GPU timing not reliable | [V] |
| Source fetching (curl) | Bundle grep and file sizes | Sizes are decoded; no wire sizes | [V] |
| REA | Available, **not needed**: no native or obfuscated runtime question | — | — |
| Chrome DevTools MCP | **Not in this session's tool list** | Traces and Lighthouse were not run through it | [V] |
| Figma MCP | Not used: there is no Figma source for these references | — | — |
| Lighthouse on the references | **Not run** in this pass | Deferred to validation | — |
| Source maps | None exist (site returns HTML for `.map`) | Minified names are evidence only | [V] |

**Not run in this pass:** `pnpm typecheck`, `pnpm lint`, `pnpm test`. No code changed, so the repo's gates were not re-run. They will be run in each implementation task.

---

## 1. Principles for the combination

1. **Website A is the source of truth for function**, but the portfolio already implements most of its features through the CMS. Only the missing features are built.
2. **Website B informs the feel, not the code.** No code, assets, audio or 3D are copied.
3. **Motion never blocks content.** The LCP and the readable text are visible before any motion starts (storyboard §1).
4. **Reduced motion is a hard requirement**, and Website B fails it. The portfolio gets an explicit test (AC-M3).
5. **One task per branch and PR** (CLAUDE.md). The tasks below are sized for that.
6. **Use the existing motion system.** New scenes go in `scenes/`; new primitives only where a pattern is reused.

---

## 2. Proposed tasks

Proposed as phase **F13 — Alinhamento com as referências** (name in pt-BR per the roadmap convention; a `docs/roadmap/F13-*.md` file would be written after approval). Ordering follows the user's brief (functional architecture → motion system → sections → microinteractions → validation).

| Task | Scope | Maps to | Depends on | Priority |
|---|---|---|---|---|
| **F13-T1** | Content model for the new sections: `home.stats`, `home.experience`, `home.skills`, CV asset. **Schema first**, expand-only migration, `shared/` document schema update | A-R1, A-R3, A-R5, A-R8 | D-04 | P1 |
| **F13-T2** | Home stats strip (F3) with count-up (M-06); final values in HTML; reduced motion shows final values | A-R1 | F13-T1, D-03 | P1 |
| **F13-T3** | Experience section (F4): storytelling pin reused from the home (M-03); mobile stacked | A-R3 | F13-T1, D-01 | P1 |
| **F13-T4** | Skills section (F6): grouped lists (M-05); optional ticker (M-07) with pause control and reduced-motion stop | A-R5 | F13-T1 | P2 |
| **F13-T5** | CV download: link in header and hero to the PDF in the media library | A-R2, A-R8 | F13-T1 | P0 |
| **F13-T6** | Spring pointer helper (M-02) applied to the blueprint-style card and the magnetic CTA (fine pointer only) | Motion | — | P2 |
| **F13-T7** | AI Outreach drafter (F7) as a **client-only template** with feedback (M-13); no network call | A-R6 | D-02 | P2 (gated) |
| **F13-T8** | Validation: Lighthouse on home and a project page, axe, reduced-motion E2E, screenshot comparison, performance report | §5 | T1–T7 | P0 |

**Total new surface:** four home sections, one CV link, one client-only tool, one motion helper.

**Not in this plan:** 3D (M-14), blocking loader (M-11), custom cursor, smooth scroll, audio. See [animation-mapping §1](animation-mapping.md#1-pattern-catalogue).

### 2.1 Per-task technical plan (for approval)

**F13-T1 — content model**
- Files: `shared/` document schema (block types), `server/db/` schema (only if the block store needs a column), `server/db/migrations` (new migration, expand only), `app/pages/admin/paginas/[key].vue` (editor for the new blocks), i18n keys in 5 locales.
- Tests: schema unit tests (zod strict), migration applies cleanly locally, `pnpm check:i18n`.
- Risk: the admin editor for home blocks must accept the new types without a regression on existing home content.

**F13-T2 — stats**
- Files: `app/components/pages/HomeContent.vue` (markup with `data-motion="stat"`), `app/composables/motion/scenes/home.ts` (new `stats` step, or reuse `count.ts`).
- Tests: Vitest unit (final value present in SSR HTML); Playwright reduced-motion test (no GSAP request, final value visible).
- Accessibility: final text is the only announcement; no `aria-live` for the count.

**F13-T3 — experience**
- Files: a new block renderer, reusing the storytelling scene from `home.ts` §3 (no new scene code if the step markup matches).
- Tests: desktop pin test (Playwright, viewport 1440), mobile stacked test (390), reduced-motion stacked test.

**F13-T4 — skills**
- Files: a block renderer; CSS keyframes for the ticker in `app/assets/css/main.css` or a component `<style>` block.
- Tests: ticker stops under `prefers-reduced-motion: reduce` (Playwright computed `animation-play-state`); the duplicate copy is `aria-hidden`.

**F13-T5 — CV**
- Files: header/hero link; the PDF uploaded through the existing media library (no new endpoint).
- Tests: link returns 200 and `content-type: application/pdf`; header link keyboard reachable.

**F13-T6 — spring helper**
- Files: `app/composables/motion/spring.ts` (≤ 80 lines, no dependency), unit tests for convergence and cleanup.
- Applied only when `(pointer: fine)` and motion is allowed.

**F13-T7 — outreach drafter (if approved)**
- Files: a new component with `<form>`, native inputs with labels, tone as a radio group (keyboard arrows), output in a `<textarea readonly>` with a copy button.
- Tests: no `fetch` during submit (Playwright request log); copy via `navigator.clipboard` with fallback; i18n in 5 locales.
- Privacy: user input never leaves the browser; nothing stored.

**F13-T8 — validation**
- Run `pnpm lighthouse`, `pnpm check:budgets`, `pnpm test:a11y`, `pnpm test:e2e`.
- Screenshots at 1440, 820 and 390 against the references; results in `docs/quality/`.

---

## 3. Acceptance criteria

### 3.1 Functional parity (from Website A)

| ID | Criterion | How checked |
|---|---|---|
| AC-F1 | Every A feature in §0.4 is either covered by the portfolio or explicitly deferred with a reason | Checklist in the F13-T8 report |
| AC-F2 | Stats, experience, skills and CV are editable in the admin, in 5 locales | Admin test + `pnpm check:i18n` |
| AC-F3 | Outreach drafter (if approved) produces output with no network request | Playwright request log |
| AC-F4 | No horizontal scroll at 390 px | Playwright `scrollWidth` check |

### 3.2 Motion quality (inspired by Website B, not copied)

| ID | Criterion | How checked |
|---|---|---|
| AC-M1 | No motion delays the LCP or readable text; content visible before the scene starts | Trace; `html.motion-ok` fallback test (3 s) |
| AC-M2 | Motion uses only `transform`, `opacity` and sparingly `clip-path` | Code review; trace paint events |
| AC-M3 | **With `prefers-reduced-motion: reduce`: no GSAP request, no running CSS animation** (the test Website B fails) | Playwright: request log + `document.getAnimations()` |
| AC-M4 | No hover-only or pointer-only information | Keyboard test; axe |
| AC-M5 | Auto-moving content (ticker) can be paused and stops with reduced motion | Playwright |
| AC-M6 | No flashes above 3 per second | Review |

### 3.3 Performance and quality

| ID | Criterion | Budget / source |
|---|---|---|
| AC-P1 | Lighthouse 100 in 4 categories on home and a project page, where realistically achievable; record any gap | CLAUDE.md goal; `pnpm lighthouse` |
| AC-P2 | CLS = 0 on home | Lighthouse / trace |
| AC-P3 | No task > 50 ms during motion start-up | Trace |
| AC-P4 | JS budgets in [performance-budgets](quality/performance-budgets.md) met (article ≤ 100 KB gz) | `pnpm check:budgets` |
| AC-P5 | Motion JS (GSAP + plugins + own code) on the home stays within the storyboard's 60 KB gz target | Build report |
| AC-Q1 | `pnpm typecheck`, `pnpm lint`, `pnpm test` pass; output pasted in the task report | CLAUDE.md step 4 |
| AC-Q2 | 0 serious or critical axe violations on each changed route | `pnpm test:a11y` |
| AC-Q3 | No `v-html`; new inputs validated with zod `strict` | Review + tests |

---

## 4. Risks and trade-offs

| Risk | Impact | Mitigation |
|---|---|---|
| New block types require a schema change and an admin editor update | Medium: the CMS is the main data path | Expand-only migration; tests for old content; one task (F13-T1) before any UI |
| Experience pin on mobile | Layout jumps, a11y | Mobile is stacked (already the storyboard rule) |
| GSAP cost on the home grows with more scenes | Performance budget | Reuse the existing scenes; measure in F13-T8 |
| Website B's "feel" tempts a blocking intro | LCP regression | Rejected (M-11); only a non-blocking ticker or counter |
| Owner-supplied metrics are not verifiable | Credibility | D-03: owner confirms each figure; no invented numbers |
| Outreach drafter could be seen as a claim of AI | Trust | Client-only and labelled as a template (D-02) |
| Headless software WebGL cannot measure frame rate | Unverified motion performance | Mark as not measured; test on a real device before release |

---

## 5. Validation plan (F13-T8)

| Check | Tool | Routes |
|---|---|---|
| Functional parity | Playwright (E2E) | `/`, `/projetos`, `/blog`, `/contato`, `/sobre` |
| Reduced motion | Playwright (`reducedMotion: 'reduce'`) | Home, project page |
| Accessibility | axe via `pnpm test:a11y`; manual keyboard pass | Changed routes |
| Performance | `pnpm lighthouse`, trace | Home, project page, article |
| Visual parity | Screenshots at 1440 / 820 / 390, compared with [screenshots/](research/screenshots/) | Home |
| Cross-browser | Playwright Chromium and WebKit (both installed) | Home |

---

## 6. Decisions needed from the owner

| ID | Question | Recommendation | Blocks |
|---|---|---|---|
| **D-01** | Build the experience section as a pinned storytelling block (reuses the approved pattern)? | Yes | F13-T3 |
| **D-02** | AI Outreach drafter: build it as a client-only template, build it with Workers AI (needs ADR and cost review), or skip it? | Client-only template | F13-T7 |
| **D-03** | Confirm the four stats figures and their wording (6+ years; 5M+ users served; 90%+ coverage; 70–80% faster load), since the portfolio cannot verify them | Confirm each one | F13-T2 |
| **D-04** | Migrate the experience, skills and CV content from Website A into the portfolio's CMS as owner content? | Yes, with the owner's text | F13-T1, T3, T4, T5 |
| **D-05** | Keep 3D out of scope (no Three.js, no WebGL hero)? | Yes; it was discarded in F10-T5 | Confirms scope |
| **D-06** | Language of these docs: English (as produced) or pt-BR (CLAUDE.md convention)? | pt-BR, to match the project; I can translate | Docs only |
| **D-07** | Approve the phase name and the tasks F13-T1 to F13-T8, and their order relative to the pending F12-T5 launch task? | Approve, and do F13 after F12-T5 | Start of implementation |

---

## 7. Deliverables status

| Deliverable (from brief) | Status | Location |
|---|---|---|
| Repository assessment | Done | §0 of this document |
| Website A functional analysis | Done (with limitations) | [research/website-a-functional-analysis.md](research/website-a-functional-analysis.md) |
| Website B motion analysis | Done (headless, software GL; frame rates not measured) | [research/website-b-motion-analysis.md](research/website-b-motion-analysis.md) |
| Animation mapping | Done | [animation-mapping.md](animation-mapping.md) |
| Implementation plan | Done, awaiting approval | this document |
| Motion design system docs | Exists | [design/motion-principles.md](design/motion-principles.md), [ADR-0011](architecture/adr/0011-motion.md) |
| Architecture doc | Exists under a different name | [architecture/overview.md](architecture/overview.md). A root `ARCHITECTURE.md` would duplicate it, so it is not proposed |
| README | Exists | [../README.md](../README.md) |
| Automated tests | Exists (Vitest, Playwright); new tests per task | F13-T1…T8 |
| Performance report | To be written in F13-T8 | `docs/quality/` |
| Source code changes | **None yet**, pending approval | — |
