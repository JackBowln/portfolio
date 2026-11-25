# Website A — functional analysis

**Reference:** https://vinicius-viola-workfolio.lovable.app/ (the owner's current portfolio, built on Lovable)
**Captured:** 2026-11-25, headless Chromium (Playwright 1.64), 1440×900 / 820×1180 / 390×844.
**Role in this project:** source of truth for **what** the product does (see [implementation-plan.md](../implementation-plan.md)).

**Legend:** **[V]** verified by browser inspection or by reading the shipped bundle · **[A]** assumption or inference, not directly observed.

---

## 1. Summary

Website A is a single-page portfolio with one long home page and one blog listing with three articles. It has no backend of its own: the only network call the site makes is an analytics beacon, and the one interactive tool (the outreach drafter) runs entirely in the browser. It has a 404 page.

| Area | Status |
|---|---|
| Routes | `/`, `/blog`, `/blog/<slug>` (×3), a catch-all 404 |
| Server API | None. The only non-GET request is an analytics beacon (`/__l5e/trackevents`) **[V]** |
| Forms | One interactive form (AI Outreach drafter). The "Contact" section is links, not a form **[V]** |
| Content source | Hard-coded in the bundle (no CMS, no fetch of content) **[V]** (no content request appears in the network log) |
| Console errors at load | None on desktop **[V]** |
| Horizontal overflow at 390 px | None **[V]** |

---

## 2. Routes and information architecture

| Route | Observed | Evidence |
|---|---|---|
| `/` | Single page with anchor sections: `#top`, `#experience`, `#projects`, `#skills`, `#outreach`, `#contact` | Nav `href`s and `h2` headings **[V]** |
| `/blog` | "Blog" H1 and three article links | Route probe **[V]** |
| `/blog/migrating-vue-2-to-vue-3-at-scale`, `/blog/design-systems-in-code-banking`, `/blog/ai-assisted-frontend-workflows-claude-code` | Article pages: H1, lead paragraph, body paragraphs. No "back" link was found | Route probe **[V]** |
| `/does-not-exist` | "404 · Page not found" | Route probe **[V]** |
| `/__l5e/assets-v1/…/Vinicius_Dias_CV.pdf` | The CV, linked from the header and hero | Link `href`s **[V]** |

**Navigation:** a sticky header with brand, six anchors (Experience, Projects, Skills, AI Outreach, Blog, Contact), and a CV button. The anchor links are on-page; "Blog" is a route change **[V]**.

---

## 3. Feature inventory

| # | Feature | Section | Detail | Verified |
|---|---|---|---|---|
| F1 | Hero | `#top` | Eyebrow "Lisbon, Portugal · Senior Frontend & Product Engineer"; H1 "Building scalable interfaces & design systems."; lead paragraph; CTAs: **Draft outreach** (→ `#outreach`), **Download CV**, **Blog**, **GitHub**; secondary **LinkedIn** link | [V] |
| F2 | "System blueprint" card | Hero, right column | Decorative card listing three focus areas (Design Systems, Architecture, AI Workflows) and a footer "60 FPS · GPU Composed" and "v2026.1". The claims are decorative: nothing measures FPS on the page | [V] (content), [A] (purpose) |
| F3 | Stats strip | Below hero | Four figures: **6+** years experience; **5M+** users served (EnBW); **90%+** critical test coverage; **70–80%** faster load times. These are owner-supplied claims and cannot be verified from the site | [V] (presence) |
| F4 | Selected Experience | `#experience` | Six roles as H3s: Emotion Mobility, EnBW, TLScontact, Bee Engineering, ISH Technology (SafeLabs), TOTVS · Wepipe · Liberfly (grouped). Each role has its own description (not captured in full) | [V] (headings) |
| F5 | GitHub Projects | `#projects` | Six project cards with links to GitHub repos, and one live demo link (Star Wars Explorer on Vercel): Roses Cortinas & Persianas (landing page), Collection Manager, TV Series Manager, Kanban Dashboard, Star Wars Explorer, PokéApp | [V] |
| F6 | Skills & Background | `#skills` | Grouped lists: Core Frontend; UI & Design Systems; AI-Assisted Engineering; Architecture & Testing; DevOps & Ecosystem; plus Education, Languages, Certifications | [V] (headings) |
| F7 | AI Outreach drafter | `#outreach` | Heading "Draft a tailored message in seconds." Inputs: *Your name* (optional), *Company / team* (optional), *Opportunity or collaboration* (textarea). Tone chips: **Professional**, **Concise**, **Warm**. Submit: **Draft outreach**. Output panel with **Copy email** | [V] |
| F8 | Blog listing | `/blog` | Three articles, each linked | [V] |
| F9 | Article pages | `/blog/:slug` | H1, lead, body paragraphs | [V] |
| F10 | Contact | `#contact` | Heading "Let's build something together." Links: email (`mailto:`), phone (`tel:`), LinkedIn, GitHub. **No form** | [V] |
| F11 | CV download | Header, hero | PDF link | [V] |
| F12 | 404 page | Any unknown path | "404 · Page not found" | [V] |

### 3.1 AI Outreach drafter — behaviour (F7)

- Typed input is turned into a message in the browser. Submitting produced paragraphs that combine the owner's bio ("6+ years building scalable web applications with TypeScript, React, and Vue…") with the input the user typed **[V]**.
- Submitting caused **no non-GET network request** **[V]**. The generator is client-side and does not call an AI API.
- Tone chips change the output. This was **not** verified for each tone **[A]**.
- "Copy email" copies the output to the clipboard. Not verified **[A]**.

---

## 4. User journeys (observed)

1. **Recruiter, desktop, first visit:** lands on the hero → reads the stats → scrolls Experience → Projects → Skills → **Draft outreach** → copies a message → **Download CV**.
2. **Reader:** header **Blog** → article list → article page. No related-posts, tags, dates or back link were found **[V]**.
3. **Wrong URL:** 404 page. No link back to home was checked **[A]**.

---

## 5. Layout and responsive behaviour

| Viewport | Observation | Verified |
|---|---|---|
| 1440 px | Two-column hero (copy left, blueprint card right). Stats in a four-column row. Full-width section rules | [V] (screenshot `screenshots/a-desktop-fold.png`) |
| 820 px | Captured (`screenshots/a-tablet-fold.png`). Column layout was not compared in detail | [V] (capture), [A] (layout) |
| 390 px | Single column. No horizontal scroll (`scrollWidth ≤ innerWidth`) | [V] (`screenshots/a-mobile-fold.png`) |

Document height at 1440 px is about 5,600 px.

---

## 6. Content structure

- Content is static text inside the JavaScript bundle; there is no CMS and no content request **[V]**.
- Blog articles are routed by slug (`/blog/<slug>`) **[V]**.
- Project cards link to GitHub repos and one live site **[V]**.
- The owner's real content (names, companies, metrics) appears on the site. The portfolio project must treat this as **owner-supplied** content and not invent anything beyond it (see [CLAUDE.md](../../CLAUDE.md), "Conteúdo real").

---

## 7. Accessibility (observed)

| Item | Observation | Verified |
|---|---|---|
| Heading structure | One H1, H2 per section, H3 per item. Good ordering | [V] |
| Landmarks | Header and nav present; `main` not checked | [A] |
| Keyboard focus | Not tested | [A] |
| Colour contrast | Not measured with a tool | [A] |
| Images | `<img>` count is 0 on the home page; the project and hero visuals are SVG/CSS | [V] |
| Skip link | Not checked | [A] |
| Reduced motion | No load-time animation runs in either mode (`getAnimations()` = 0 with and without `prefers-reduced-motion: reduce`). Scroll-triggered motion under reduce was not measured | [V] (load), [A] (scroll) |

---

## 8. Rendering and technical findings

| Topic | Finding | Verified |
|---|---|---|
| Delivery | Vite-style static build: `/assets/index-*.js`, `routes-*.js`, `styles-*.css`. SPA with a catch-all for unknown routes | [V] |
| Framework | Not confirmed by name. The `whileInView` prop (a Framer Motion / `motion` API) is in the routes chunk; the "Edit with Lovable" badge indicates a Lovable-generated project | [V] (API name), [A] (React + Tailwind + Radix) |
| Motion library | Framer Motion-style `whileInView` present. **No GSAP, no ScrollTrigger, no Lenis** in any bundle (0 matches) | [V] |
| View Transitions | `startViewTransition` appears in the entry bundle (4 matches). Its use on route changes was not exercised | [V] (presence), [A] (use) |
| Keyframes | `accordion-up/down`, `caret-blink`, `enter`, `exit`, `pulse`, `spin` — the usual Tailwind/shadcn animation set (enter/exit suggest dialogs or toasts) | [V] |
| Fonts | Google Fonts CSS: Fraunces, DM Sans, IBM Plex Mono. 147 KB of font files fetched from `fonts.gstatic.com` at load | [V] |
| JS weight (decoded) | `index-*.js` 337 KB + `routes-*.js` 184 KB + analytics 29 KB ≈ **557 KB** of script, uncompressed | [V] |
| CSS weight (decoded) | 80–89 KB | [V] |
| Requests on load | 13 | [V] |
| Source maps | `…js.map` returns 404 | [V] |
| Console | No errors or warnings on the desktop run | [V] |
| Analytics | `/__l5e/…` beacon. Third-party analytics not identified | [V] |
| Performance measurement | No Lighthouse or Web Vitals run in this pass (deferred to the validation step) | — |

---

## 9. Implementation requirements derived from Website A

These are the **functional** requirements the Nuxt project must satisfy. Each one is mapped to what the portfolio already does in [implementation-plan.md](../implementation-plan.md).

| ID | Requirement | Notes |
|---|---|---|
| A-R1 | Home with hero, stats strip, experience, projects, skills, contact | Experience and skills have no equivalent in the portfolio today (see plan §2) |
| A-R2 | Hero CTAs: outreach, CV, blog, GitHub, LinkedIn | Outreach CTA depends on A-R6 |
| A-R3 | Experience list with roles and descriptions | New content type or home block; needs schema work |
| A-R4 | Projects list (GitHub-style cards) with links | Portfolio projects already cover this with a richer model |
| A-R5 | Skills grouped by category | New content type or home block |
| A-R6 | Outreach drafter (inputs, tone, copy) | Client-side is possible at no cost; requires owner approval (see plan §5) |
| A-R7 | Blog listing and article pages | Already implemented (F06) |
| A-R8 | CV download | Needs the PDF as a media/asset in the portfolio |
| A-R9 | 404 page | Already implemented (`app/error.vue`) |
| A-R10 | No horizontal overflow at 390 px | Existing CI budget should cover this |

**Not required (intentionally):** the Lovable badge, the decorative "60 FPS" text, the analytics beacon, and Google Fonts from a third party (the portfolio self-hosts its fonts; see [CLAUDE.md](../../CLAUDE.md)).

---

## 10. Limitations of this analysis

- Only the home page, the blog listing, one article, the 404 page and the outreach drafter were exercised. Hover states, focus order, and all tone chips were not walked through.
- Layout at 820 px was captured but not compared element by element.
- Lighthouse, Core Web Vitals and axe scans were **not** run on Website A in this pass.
- Only Playwright was used. REA and the Chrome DevTools MCP were not needed for these findings (no native or obfuscated runtime behaviour required them).

---

## Screenshots

| File | Viewport | Notes |
|---|---|---|
| [screenshots/a-desktop-fold.png](screenshots/a-desktop-fold.png) | 1440 × 900 | Hero, blueprint card, stats |
| [screenshots/a-tablet-fold.png](screenshots/a-tablet-fold.png) | 820 × 1180 | Hero at tablet width |
| [screenshots/a-mobile-fold.png](screenshots/a-mobile-fold.png) | 390 × 844 | Single column |
