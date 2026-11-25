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
| Stats strip (4 figures) | Highlights exist for projects (`count` scene); no home stats strip. **F13-T1 added the content model** (`home.stats`) | **Missing** on home (rendering is F13-T2) | [V] (`shared/pages/blocks.ts`) |
| Experience (6 roles) | `about.timeline` (period, title, text) with an admin editor, rendered on `/sobre` | **Covered on `/sobre`; missing on the home.** Reuse it; no new content type | [V] (`shared/pages/blocks.ts`, `app/pages/sobre.vue`) |
| GitHub-style projects | Projects with case studies, filter, ordering, publication | **Covered**, and richer | [V] |
| Skills & background | `about.skills` (group, items) with an admin editor, rendered on `/sobre` | **Covered on `/sobre`; missing on the home.** Reuse it | [V] (`shared/pages/blocks.ts`, `app/pages/sobre.vue`) |
| AI Outreach drafter | None | **Missing** | [V] (grep: 0 matches) |
| Blog and articles | Full: list, article, topics, RSS | **Covered** | [V] |
| Contact | Real form, Turnstile, inbox | **Covered**, stronger than A (A has no form) | [V] |
| CV download | No CV asset. The media pipeline accepts only images (JPEG, PNG, WebP, AVIF) and videos (MP4, WebM); the `file` kind exists in the enum but nothing uses it | **Blocked** (decision D-08): a PDF path needs a new media kind and a security review, or the CV is an external https link | [V] (`shared/media/schemas.ts`, `shared/types/enums.ts`) |
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
| **F13-T1** | ~~Content model~~ **Done** (`bad2d68`): `home.stats` in the schema and the admin editor. The experience and skills content models already exist in `about`, and CV was split out (D-08) | A-R1 | — | P1 |
| **F13-T2** | Home stats strip (F3) with count-up (M-06); final values in HTML; reduced motion shows final values | A-R1 | F13-T1, D-03 | P1 |
| **F13-T3** | Experience on the home (F4): the `about.timeline` data, shown as the storytelling pin (M-03); mobile stacked. Needs the public home to read the about timeline, a change to the public page API | A-R3 | D-01 | P1 |
| **F13-T4** | Skills on the home (F6): the `about.skills` data as grouped lists (M-05); optional ticker (M-07) with pause control and reduced-motion stop | A-R5 | D-01 | P2 |
| **F13-T5** | CV download: link in header and hero | A-R2, A-R8 | D-08 | P0 (blocked) |
| **F13-T6** | Spring pointer helper (M-02) applied to the blueprint-style card and the magnetic CTA (fine pointer only) | Motion | — | P2 |
| **F13-T7** | AI Outreach drafter (F7) as a **client-only template** with feedback (M-13); no network call | A-R6 | D-02 | P2 (gated) |
| **F13-T8** | Validation: Lighthouse on home and a project page, axe, reduced-motion E2E, screenshot comparison, performance report | §5 | T1–T7 | P0 |

**Total new surface (after the F13-T1 correction):** a home stats strip, the experience and skills content shown on the home (their data already exists in `about`), one client-only tool, one motion helper. The CV link waits for D-08.

**Not in this plan:** 3D (M-14), blocking loader (M-11), custom cursor, smooth scroll, audio. See [animation-mapping §1](animation-mapping.md#1-pattern-catalogue).

### 2.1 Per-task technical plan (for approval)

**F13-T1 — content model (done, `bad2d68`)**
- Changed: `shared/pages/blocks.ts` (`home.stats`, optional with default `[]`), the admin editor in `app/pages/admin/paginas/[key].vue`, pt-BR admin keys, `tests/unit/home-stats.test.ts`.
- No SQL migration: page blocks are JSON. Pages saved before the field still parse.
- Verified: `test:unit` 486/486, `test:workers` 137/137, `typecheck` exit 0, `check:i18n` OK. `lint` fails only in `nuxt.config.ts` (pre-existing formatting change, not in the commit). The editor was not exercised in a browser.

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
| **D-04** | Migrate the experience and skills content from Website A into the portfolio's CMS? The `about` page already has the editors and the data model; only the owner's text is missing | Check the existing `/sobre` content against Website A and fill any gaps | F13-T3, T4 |
| **D-08** | CV download (F13-T5): (a) an external https link to the CV the owner already hosts, using the existing link fields (no code); or (b) store the PDF in the media library, which needs a new `file` media kind, a PDF path through the pipeline and a security review, as an ADR | (a) now; (b) only if the owner wants the PDF self-hosted | F13-T5 |
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
| Source code changes | Done for F13-T1 to T4 and T6 (see §8) | branches `feat/F13-*` |

## 8. Status (2026-11-25)

### 8.1 Owner decisions

| ID | Answer | Effect |
|---|---|---|
| D-01 | Yes: the experience is the pinned storytelling block on the home | F13-T3 |
| D-02 | Client-only drafter, no AI cost | F13-T7 (copy needs approval, see 8.3) |
| D-03 | Figures from the CV and GitHub (46 public repos on `JackBowln`). LinkedIn could not be read anonymously (it redirects) | Figures are for the admin to enter (see 8.2) |
| D-05 | No 3D | M-14 stays out |
| D-06 | Docs in pt-BR, as CLAUDE.md asks | Translation pending (see 8.3) |
| D-07 | F13 approved; start after F12-T5 | Branches are ready, merge order follows F12-T5 |
| D-08 | CV self-hosted | F13-T5 needs ADR-0017 accepted first |

### 8.2 Figures for D-03, as the CV supports them

| Figure (`value`) | Label (`label`) | Source in the CV |
|---|---|---|
| `6+` | Years of frontend experience | Summary: "6+ years of experience" |
| `~5M` | Users on the platform I led the frontend of | EnBW: "a platform serving around 5 million users" |
| `70–80%` | Faster page loads after the Nuxt migration | Bee Engineering, Link Consulting: "reducing page load times by 70-80%" |
| `90%+` | Coverage of critical components | TLScontact: "over 90% coverage on critical components" |

Two wording changes from the first draft: "5M+" became "~5M" (the CV says "around"), and the labels now say what the source supports. The owner enters these in the home page's editor, in the "Números" section. Nothing is seeded.

### 8.3 Commits and what is left

| Task | State | Commit |
|---|---|---|
| F13-T1 home stats content model | Done | `bad2d68` |
| F13-T2 stats strip with count-up | Done | `bbe9c5c` |
| F13-T3 experience pinned on the home | Done | `144a7b0` |
| F13-T4 skill groups on the home (ticker not included) | Done | `cb7cec1` |
| F13-T5 CV self-hosted | **Blocked** on ADR-0017 (Proposto) and then a media-kind change touching about 44 branch points | ADR `ff16193` |
| F13-T6 spring magnetic CTA | Done | `3deacba` |
| F13-T7 outreach drafter, client-only | **Pending**: the drafter's wording in five locales needs the owner's approval first | — |
| F13-T8 validation | **Pending**: needs the figures and the experience entered in a local database, then Lighthouse, axe, Playwright and screenshots | — |
| D-06 translation of these docs | **Pending** | — |

### 8.4 Verified so far

- `test:unit` 493/493 passed, `test:workers` 138/138, `test:nuxt` motion and home tests pass, `typecheck` exit 0, `check:i18n` OK, `check:budgets` OK, `build` OK.
- Home route JS: 122.92 kB of a 125 kB limit, measured after T1 to T4 and T6 (2 kB of headroom); CSS 7.61 kB of 30 kB. The `/blog` route is at 126.23 of 127 kB, which is not caused by these tasks. Re-measure at T8.
- `lint` fails only in `nuxt.config.ts` (the formatting change that was already uncommitted). Every new file lints clean.
- Not verified: the rendered strip, the pin and the count-up in a real browser. The component tests cover markup and the workers test covers the data path.
