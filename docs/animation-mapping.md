# Animation mapping — Website A sections × Website B patterns

**Inputs:** [website-a-functional-analysis.md](research/website-a-functional-analysis.md) (what the product does) and [website-b-motion-analysis.md](research/website-b-motion-analysis.md) (how motion feels).
**Rules applied:** [motion-principles.md](design/motion-principles.md), [storyboard-home.md](design/storyboard-home.md) (approved 04/11/2026), CLAUDE.md "Motion" and "Performance".
**Legend:** **Existing** = already implemented in the portfolio; **New** = proposed, needs approval; **Reject** = not used.

---

## 1. Pattern catalogue

Each pattern is reusable. Website B's ideas are translated into the portfolio's motion system (GSAP on demand, CSS for micro-interactions, `html.motion-ok` gating).

| ID | Pattern | Source idea (Website B) | Portfolio implementation | Status |
|---|---|---|---|---|
| M-01 | **Opening choreography** — hairline, eyebrow, subtitle, CTA in sequence; title never hidden | Staged entrance of the hero (§4.1) | `homeScene` §2 (GSAP timeline) | Existing (F10-T3) |
| M-02 | **Spring pointer response** — a second-order spring follows the pointer for small offsets | `SecondOrderDynamics` on camera and cursor (§4.1, §4.3) | Re-implemented as a tiny TS helper (no dependency), used by `quickTo`-style targets. **Fine pointer only**, offset ≤ 6 px | New (P2) |
| M-03 | **Pinned storytelling with scrub** | Scroll-linked narrative (Website B's scroll model, rejected as scrolljacking; kept only as scrub on a pinned block) | `homeScene` §3 | Existing (F10-T3) |
| M-04 | **Image reveal** — clip-path inset to full, slight scale; mobile fades only | Panel un-skew reveal (§3) | `homeScene` §4 (`clipPath` + `scale`) | Existing (F10-T3) |
| M-05 | **Staggered list reveal** — one-time, `opacity` + `y` (≤ 24 px), 40–80 ms stagger | Staggered entrances | `gsap.from` with `once` ScrollTrigger | Existing (F10-T3) |
| M-06 | **Count-up for real figures** — 800 ms, final value in HTML | Numeric animation (not in B; added from storyboard §3 "Contador") | `count` scene | Existing for project highlights; **New** for the home stats strip (P1) |
| M-07 | **Looping ticker** — a slow horizontal marquee of tags, pausable, duplicated copy `aria-hidden` | Looping category lines (§4.2) | CSS `@keyframes` on `transform`; pause on hover/focus and a visible control; `prefers-reduced-motion` stops it | New (P2) |
| M-08 | **Route transition** — View Transitions crossfade; element morph for card → case study | Page transitions (Website A uses `startViewTransition`; B has none) | `experimental.viewTransition` + `main.css` | Existing (F10-T4) |
| M-09 | **Magnetic CTA** — ≤ 6 px, fine pointer only | Magnetic-style hover (B has none; the storyboard keeps it small) | `closingScene` magnet | Existing (F10-T3) |
| M-10 | **Hover feedback** — link underline and small scale, 120 ms CSS | Hover microinteractions | Tailwind + tokens | Existing (F10-T4) |
| M-11 | **Dramatic percentage loader** — 0 → 100 counter gating the page | Website B intro (§3) | — | **Reject** (blocks content, LCP) |
| M-12 | **Per-character hover split** | Per-letter spans (§4.2) | — | **Reject** for now (screen-reader noise, cost). Revisit only with `aria` handling |
| M-13 | **Form and state feedback** — tone chip state, copy confirmation, output reveal | Microinteractions | CSS 120 ms + `aria-live` status | New (P2) |
| M-14 | **3D hero** — Three.js scene like Website B | §4.1, §5 | — | **Deferred**: needs an ADR and explicit approval (F10-T5 was discarded). Budget if ever approved: ≤ 180 KB gz, poster as LCP |
| M-15 | **Custom cursor / cursor-driven camera** | §4.3 | — | **Reject** (motion-principles §3) |
| M-16 | **Smooth scroll / scroll hijack** | §4.4 | — | **Reject** (motion-principles §3) |
| M-17 | **Audio** | §4.6 | — | **Reject** (not in storyboard) |

---

## 2. Website A sections → patterns

Each row is a component of Website A (see the functional analysis, §3), with the proposed motion. Desktop is the full version; mobile follows the storyboard's simplified variant; reduced motion means no GSAP is downloaded (CLAUDE.md).

| A ID | Component (A) | Functional reference | Proposed animation | Trigger | Desktop | Mobile / tablet | Reduced motion | No JS | Priority |
|---|---|---|---|---|---|---|---|---|---|
| F1 | Hero | Eyebrow, H1, lead, CTAs | M-01 (existing) | Load, after LCP | Full timeline (~1.1 s) | Fade only, no split | Visible, no movement | Visible | P0 (done) |
| F2 | Blueprint card | Decorative rows; "60 FPS" text is not a functional claim | Static card. Optional M-02 tilt on fine pointer (≤ 4 px). **Drop the "60 FPS" text** — it is not measured by anything | Hover (fine pointer) | Optional tilt | None | None | Static | P2 |
| F3 | Stats strip | Four figures (owner-supplied) | M-06 count-up, 800 ms, once in viewport | Entry into view | Count-up | Final value | Final value | Final value | P1 |
| F4 | Experience | Six roles with descriptions | M-03 pinned storytelling with scrub (desktop, ≥ 3 roles). Each role is one step | Scroll progress | Pin + scrub | Stacked, M-05 reveal | Stacked, static | Stacked | P1 |
| F5 | Projects | Project cards with links and tags | M-04 cover reveal + M-05 text (existing `ProjectCard`) | Viewport, once | Clip-path reveal | Fade only | Static | Visible | P0 (done) |
| F6 | Skills | Grouped skill lists | M-05 for groups. **Optional** M-07 ticker for tags inside a group, paused by default on focus/hover; no ticker for screen-reader content | Viewport; ticker always moving (controllable) | List reveal, ticker optional | List reveal only, no ticker | Static list, no ticker | Static list | P2 |
| F7 | AI Outreach drafter | Form, tone chips, output, copy | M-13 feedback only: chip state 120 ms, output reveal M-05 (≤ 8 px), copy confirmation via `aria-live` | User action | Feedback + reveal | Feedback only | Instant | Native form | P2 (depends on decision D-02) |
| F8 | Blog listing | Article cards | M-05 light fade (existing) | Viewport, once | Fade + stagger 60 ms | Fade | Static | Visible | P0 (done) |
| F9 | Article page | Long-form text | **None** (storyboard: no motion in articles) | — | — | — | — | Visible | P0 |
| F10 | Contact | Links to email, phone, LinkedIn, GitHub. Real form is in `/contato` (existing) | M-09 magnetic CTA on the primary contact action (existing) | Pointer, fine only | Magnetic ≤ 6 px | None | None | Links | P0 (done) |
| F11 | CV download | PDF link | M-10 hover underline (CSS) | Hover/focus | CSS | Same | Instant | Link | P0 |
| F12 | 404 | "Page not found" | None | — | — | — | — | Visible | P0 |
| — | Route changes | View Transitions (A) | M-08 crossfade; card → case study morph (existing) | Navigation | Crossfade 200–320 ms | Crossfade | Instant | Normal navigation | P0 (done) |

---

## 3. Priority and phasing

| Priority | Meaning | Items |
|---|---|---|
| **P0** | Already in the portfolio, or required for parity | F1, F5, F8, F9, F10, F11, F12, route transitions |
| **P1** | Adds real value to the functional parity of A | F3 count-up, F4 storytelling for experience |
| **P2** | Polish; only after P0/P1 pass the budgets | F2 tilt, F6 ticker, F7 feedback, M-02 spring helper |
| **Deferred** | Needs a new decision | M-14 3D hero |
| **Rejected** | Conflicts with the rules | M-11, M-12, M-15, M-16, M-17 |

---

## 4. Technical implementation per pattern

| Pattern | Technical approach | Dependencies | Cleanup | Performance rule |
|---|---|---|---|---|
| M-01, M-03, M-04, M-05, M-09 | Existing `homeScene` / `gsap.context`; `matchMedia` for breakpoints and reduced motion | GSAP (already, on demand) | `ctx.revert()` on unmount and when motion is turned off | Only `transform`, `opacity`, `clip-path` (sparingly) |
| M-02 | `Spring` helper in `app/composables/motion/spring.ts` (second-order: stiffness, damping, mass; integrates in `requestAnimationFrame`, stops at rest). Applied to `transform` only | None | Cancel rAF on stop; detach pointer listeners | Runs only with `(pointer: fine)` and motion allowed; no rAF when idle |
| M-06 | `count` scene: reads the final text from the DOM, animates an integer with `gsap.to` and writes it back; sets the final value immediately with reduced motion | GSAP | Revert on unmount | One tween per figure; no layout reads inside the tween |
| M-07 | Pure CSS `@keyframes` on `transform: translateX`; `animation-play-state: paused` on hover/focus and via a visible toggle; duplicate copy has `aria-hidden="true"` | None | None (CSS) | Compositor-only; no JS |
| M-08 | `experimental.viewTransition` (already on) | None | — | Respect `prefers-reduced-motion` in `main.css` |
| M-13 | CSS transitions; a single `aria-live="polite"` region for "copied" | None | — | No JS when outreach is server-free |

**Placement:** new scenes go in `app/composables/motion/scenes/`, targets are found by `data-motion`, and the director stays unchanged. CSS-only patterns (M-07, M-10) do not import GSAP at all.

---

## 5. Responsive and reduced-motion rules (summary)

| Breakpoint / preference | Rule |
|---|---|
| ≥ `md` (768 px), fine pointer | Full timelines, pins, magnetic and spring effects |
| < `md` | Fades only; no pins; no clip-path on mobile (matches storyboard) |
| `prefers-reduced-motion: reduce` or the site's "Reduzir movimento" | GSAP is not downloaded; CSS movement is removed (opacity transitions ≤ 200 ms at most); tickers stop; counts show the final value |
| No JavaScript | All content visible in the static HTML; hairline already drawn |

**Website B's failure to honour reduced motion** (verified, see its analysis §4.5) is the reason for the explicit test in the plan (AC-M3).

---

## 6. Accessibility requirements per pattern

| Pattern | Requirement |
|---|---|
| M-01, M-03 | The pinned story keeps all text in DOM order; inactive steps are not `aria-hidden`; focus is never hidden behind a pinned element |
| M-02 | Only on fine pointers; never moves focusable controls out of reach; reduced motion disables it |
| M-06 | The final value is in the HTML; the announcement is the final text, not the intermediate frames |
| M-07 | Pause control reachable by keyboard; `aria-hidden` on the duplicate copy; stops with reduced motion; never auto-moves more than 5 s without a pause (WCAG 2.2.2) |
| M-09 | The link stays the focusable element; the magnet does not change hit area |
| M-13 | Status messages through `aria-live`; no motion that conveys information alone |
| All | No flashes above 3 per second (WCAG 2.3.1); focus indicator visible at all times (WCAG 2.4.7) |

---

## 7. Performance cost estimate

| Item | Estimated cost | Basis |
|---|---|---|
| GSAP and plugins | Already loaded after LCP on routes with motion; not on the article page | Existing rule (motion-principles §5) |
| M-02 helper | < 1 KB gz; zero work when idle | Hand-written; no dependency |
| M-06 counts | One tween per figure (4 on the home) | Within GSAP already loaded |
| M-07 ticker | 0 KB JS; compositor transform | CSS only |
| 3D (M-14) | Not planned. If approved, ≤ 180 KB gz additional and loaded by IntersectionObserver | motion-principles §5 |

**Measurement required** before any P1/P2 item ships: a Lighthouse run of the affected route, a trace with no task above 50 ms during start-up, and CLS = 0. See the implementation plan's acceptance criteria.

---

## 8. Decisions this mapping depends on

| ID | Question | Recommendation |
|---|---|---|
| D-01 | Replace the home storyboard's "Experience" with the storytelling pin (F4)? | Yes: reuses the approved pattern M-03 |
| D-02 | Build the AI Outreach drafter? If yes, as a client-only template or with Workers AI? | Client-only template, no AI cost. Needs owner approval because it is a new product feature |
| D-03 | Accept the stats strip with the four owner-supplied figures? | Yes, if the owner confirms each one. The portfolio's rule forbids inventing metrics |
| D-04 | Keep 3D (M-14) out of scope? | Yes. It was discarded in F10-T5 and costs budget |
