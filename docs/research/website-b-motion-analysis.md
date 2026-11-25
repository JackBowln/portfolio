# Website B — motion and interaction analysis

**Reference:** https://lusion.co/ (Lusion, a 3D and interactive web studio)
**Captured:** 2026-11-25, headless Chromium, 1440×900 / 820×1180 / 390×844. Routes probed: `/`, `/about`, `/projects`, `/projects/oryzo_ai`.
**Role in this project:** inspiration for **how** motion feels. It is **not** a source for code, assets or 3D scenes.

**Legend:** **[V]** verified by browser inspection or by reading the shipped bundle · **[A]** assumption or inference · **[N/M]** not measured in this pass.

---

## 1. Summary

Lusion is a single-viewport WebGL experience. The document never scrolls natively (`html` and `body` are `overflow: hidden`, document height 900 px). Scrolling, pointer and camera movement are handled by a custom input system that drives a Three.js scene. Motion is spring-based and tied to the cursor and camera, not to CSS timing curves.

| Question | Answer | Verified |
|---|---|---|
| Animation library | No GSAP, ScrollTrigger, Lenis, SplitText, Splitting or ScrollSmoother in the bundle (0 matches each). Three.js is present (152 `THREE` matches; WebGL warnings name `THREE.WebGLRenderer`) | [V] |
| 3D engine | Three.js with post-processing (GTAO ambient occlusion, camera motion blur named in the source) | [V] (names), [A] (exact pipeline) |
| Custom motion | A `SecondOrderDynamics` class (spring–damper) drives camera, cursor-follow and focus motion | [V] (class and usages in source) |
| Scroll model | Custom wheel/touch/pointer manager. A `window` `wheel` listener calls `preventDefault` (`passive: false`) | [V] |
| Native scroll | Disabled. `html`/`body` `overflow: hidden`, document height 900 px | [V] |
| Smooth scroll library | None found. The scroll is a custom physics model over the 3D scene | [V] |
| Reduced motion | **Not honoured** for the CSS animations: the same 6 animations run with and without `prefers-reduced-motion: reduce` | [V] |
| Source maps | None. `…js.map` returns `text/html` (site fallback), not a map | [V] |

---

## 2. Routes and structure

| Route | Observed | Verified |
|---|---|---|
| `/` | Hero is a 3D canvas in a framed 16:9 panel. Headline "We create 3D visual storytelling and interactive web experiences…". Newsletter form with Cloudflare Turnstile | [V] |
| `/about` | Same shell (3 canvases), "About Us" with press links (Porsche newsroom, Wallpaper, Opera North), addresses and contacts | [V] |
| `/projects` | Project index: about 13 entries, each a text row with a category line (e.g. "CONCEPT • WEB • DESIGN • DEVELOPMENT • 3D • ANIMATION") linking to `/projects/<slug>` | [V] |
| `/projects/oryzo_ai` | Project detail with H2s, external links (GitHub, Product Hunt, launch site) | [V] |
| Header | HOME, ABOUT US, PROJECTS, LABS (external) | [V] |
| Footer | Address, social links, `hello@` and `business@` mail links | [V] |

**Page transitions:** the screenshots show a single page per route with the same WebGL shell. No View Transition API call was found (`startViewTransition`, 0 matches). Transition behaviour between routes was **not** recorded frame-by-frame [N/M].

---

## 3. Initial loading sequence (observed)

Frames captured with `waitUntil: domcontentloaded` and screenshots at fixed times (`screenshots/b-intro-300ms.png`, `screenshots/b-intro-6000ms.png`):

| Time | State | Verified |
|---|---|---|
| ~300 ms | Black screen. A progress bar in the centre (about 210×40 px, grey). A counter in the bottom-left reads `000` in a neutral sans-serif | [V] |
| ~6000 ms | The 3D tube cluster is visible, inside a panel skewed about 25–30° that is still settling; the counter reads `…00` at the bottom-left | [V] |
| Between | Counter counts up; the panel un-skews into the frame | [V] (observed endpoints), [N/M] (exact easing and duration) |

**Interpretation [A]:** a percentage loader gates the reveal of the 3D scene; the panel transform animates from skewed to upright as the scene becomes ready. The exact trigger (asset download, GPU compile or a fixed timeline) is not known.

**Blocking:** the page content is hidden behind this loader. This is the opposite of what the portfolio's rules allow (the LCP must not wait for motion).

Counts observed during the intro: 11 elements matching `[class*=loader]`, `[class*=loading]` or `[id*=loader]` were displayed. Their meaning was not confirmed [N/M].

---

## 4. Motion inventory

For each animation, the table lists what could be verified. Fields that cannot be read from the outside are marked **[N/M]**.

### 4.1 Hero and 3D scene

| Animation | Trigger | Target | Initial → final | Duration / easing | Notes | Verified |
|---|---|---|---|---|---|---|
| Loader counter | Page load | Text counter, bottom-left | 000 → 100 | [N/M] | Blocks the reveal | [V] |
| Panel un-skew | Load complete | 3D panel (framed canvas) | Skewed ≈ 25–30° → 0° | [N/M] | Observed at two frames | [V] (endpoints) |
| Tube cluster | Continuous | Three.js meshes | Glossy black, white and blue cylinders in a tumbling cluster | Continuous | Post-processed (GTAO), matcap shading (`matcap.exr`, 589 KB) | [V] |
| Camera / cluster response | Pointer and wheel | Camera, object rotation | Spring-driven via `SecondOrderDynamics` (names: `focusPosMotion`, `domVideoCursorExtraRotationMotion`) | Spring; constants in source | Cursor response shown as `easedMouseDyn` in the source | [V] (names), [N/M] (values) |
| Motion blur | Camera speed | Post-process | `cameraMotionBlur` present in source | — | Performance-expensive | [V] (name) |

### 4.2 Text animations

| Animation | Trigger | Target | Details | Verified |
|---|---|---|---|---|
| Looping category line (`text-animation`) | Always running (CSS) | Category strings on project rows | The line is duplicated and each character is a `<span>` repeated 4× (e.g. "O O O O r r r r y y y y…"); a CSS animation named `text-animation` runs continuously | [V] |
| Arrow animation (`arrow-animation`) | Always running (CSS) | Arrow glyphs in the links | CSS animation named `arrow-animation` runs continuously | [V] |
| Headline reveal | Load | H1 "We create 3D visual storytelling…" | Not identified as a separate text-split effect. No SplitText library present | [N/M] |

**Per-character spans:** the duplicated, per-letter markup is a pattern for character-level motion. It is a risk for screen readers unless the text is duplicated with `aria-hidden` or `aria-label` is used. Not verified [N/M].

### 4.3 Hover, pointer and cursor

| Behaviour | Evidence | Verified |
|---|---|---|
| Custom cursor | `body` cursor is `auto`. No `cursor: none` in the bundle | [V] |
| Pointer-driven 3D interaction | `pointermove`, `pointerup` and `pointercancel` handlers on the WebGL canvas; `DeviceOrientationControls` class present | [V] |
| Hover on project rows | Not captured in the probe. Source mentions a video cursor rotation (`domVideoCursorExtraRotationMotion`) | [V] (name), [N/M] (visual) |
| Magnetic buttons | No magnetic-effect code found (`magnet` 0 matches) | [V] |

### 4.4 Scroll

| Behaviour | Evidence | Verified |
|---|---|---|
| Native scroll | Disabled (`overflow: hidden`, height 900 px) | [V] |
| Wheel | `wheel` listener on `window` with `preventDefault` and `passive: false`; `wheel` listeners on the canvas | [V] |
| Touch | `touchmove` and `touchend` handlers | [V] |
| Scroll thresholds, snapping, pins | Not measured. Scroll is a virtual value inside the 3D scene | [N/M] |
| Scroll-linked parallax | Not identified separately; camera position is scroll-driven | [A] |

### 4.5 Reduced motion and accessibility

| Check | Result | Verified |
|---|---|---|
| `prefers-reduced-motion: reduce` changes running animations | **No.** `arrow-animation` and `text-animation` run in both modes (6 running in total) | [V] |
| WebGL under reduced motion | Not checked [N/M]. Probably unchanged | [A] |
| Keyboard focus on the 3D experience | Not tested | [N/M] |
| Screen reader content | H1 and H2 present; the decorative text is repeated per character | [V] (structure), [N/M] (announcements) |

### 4.6 Media and loading

| Item | Observed | Verified |
|---|---|---|
| Audio | 5 `.ogg` files requested from `lusion.dev` (`generic.ogg`, `cinematic_*.ogg`, `generic_end.ogg`). Playback not verified | [V] (requests) |
| 3D geometry | `.buf` files (`cross.buf`, `line_reel.buf`, `astronaut_helmet*.buf`) | [V] |
| Textures | `matcap.exr` (589 KB, fetch); WebP normal maps (`astronaut_*_nor.webp`, 426–450 KB each) | [V] |
| Analytics | Google tag `G-…` (gtag.js, 534 KB decoded) | [V] |
| Turnstile | Cloudflare Turnstile widget on the newsletter form. A 2 MB challenge response and a 401 response were seen | [V] |
| Console | WebGL warnings: "GPU stall due to ReadPixels", "No available adapters" (software GL), "KHR_parallel_shader_compile not supported", "Turnstile has already been rendered" | [V] |

---

## 5. Performance observations

Measured in 8 s after `load` on the home page, desktop viewport. Sizes are **decoded** body sizes from Playwright, not wire sizes.

| Metric | Website B home | Website A home | Verified |
|---|---|---|---|
| Requests | 118 | 13 | [V] |
| Document | 702 KB | 65 KB | [V] |
| Scripts | 1,902 KB (`hoisted.js` 1,222 KB, `gtag` 534 KB) | 557 KB | [V] |
| Stylesheets | 88 KB | 89 KB | [V] |
| Images | 6,161 KB | 0 | [V] |
| XHR / fetch (3D, audio, Turnstile) | 5,353 KB + 589 KB | 0 | [V] |
| Fonts | 185 KB (self-hosted Aeonik and IBM Plex Mono) | 147 KB (Google Fonts) | [V] |

**Signals in the console:** "GPU stall due to ReadPixels" indicates a synchronous GPU read-back, a known cost in WebGL pipelines.

**Not measured [N/M]:** frame rate (headless software GL; "No available adapters"), Core Web Vitals, INP, Lighthouse. These cannot be trusted from a headless software-rendered run and need to be measured on a real GPU device.

---

## 6. Patterns worth adopting (in principle)

These are the ideas behind Website B's feel, separated from its implementation:

1. **Spring physics instead of fixed easing for pointer-driven motion.** A second-order response gives a sense of weight, and it can be done without WebGL (see [animation-mapping.md](../animation-mapping.md), pattern M-02).
2. **Strong, few, deliberate motions.** Each element has a single job: the 3D panel un-skew, the cluster response, the category line.
3. **The page is a stage.** Content and motion share one composition. The portfolio's equivalent is the storyboard, not the scene graph.
4. **Image and panel reveals with transform, not layout.** The skew-to-upright reveal is a transform (see pattern M-04).
5. **Typography in motion as a secondary signal.** Looping category lines and arrows give life without blocking content (pattern M-07, with pause control).

## 7. Patterns to reject for this project

| Pattern | Why it is rejected here |
|---|---|
| Native scroll replaced by a custom wheel/touch manager (scrolljacking) | Forbidden by [motion-principles §3](../design/motion-principles.md) and CLAUDE.md. Hurts accessibility and the reading flow |
| Blocking loader with a 0→100 counter | The LCP must never wait for motion. Content must be reachable without JS |
| Ignoring `prefers-reduced-motion` | Required by WCAG 2.3.3 and the project's rules. Lusion's behaviour is the anti-pattern |
| Full-viewport WebGL scene as the main experience | No 3D without approval (F10-T5 was discarded). Also a large performance and battery cost (see §5) |
| Audio on page load | Not in the storyboard; unexpected sound is an accessibility problem |
| Custom cursor (`cursor: none`) | Forbidden by motion-principles §3. Lusion does not use it, so this is not a pattern to copy anyway |
| Per-character DOM duplication for looping text without `aria` handling | Screen reader noise; use one visible text and an `aria-hidden` decorative copy, or a CSS marquee with pause |
| Smooth-scroll library (Lenis-style) | Forbidden as artificial smooth scroll |

---

## 8. Implementation notes for the portfolio

- **No code copied.** Only the behaviour pattern is taken. The `SecondOrderDynamics` idea is re-implemented from first principles if approved (see plan §4).
- **No assets copied.** `matcap.exr`, the `.buf` geometry, the audio and the textures belong to Lusion.
- **GSAP stays the motion engine** for the portfolio, as the approved storyboard specifies. Lusion's stack is not a reason to add another library.
- **Libraries:** Three.js is the only engine confirmed by evidence. Nothing else in Lusion's bundle is confirmed as a library. Anything else (e.g. custom spring code) is inferred from class names and usage, not from a package list.

---

## 9. Limitations

- Headless Chromium with software WebGL. No real frame-rate, GPU timing or INP data.
- Only home, about, projects index and one project page were probed. Other project pages may use different motion.
- The loader timing and the skew-reveal duration were read from two frames, not a full trace. Exact values are **not** claimed.
- Hover effects on project rows and transitions between routes were not recorded.
- Turnstile and the newsletter form were not interacted with (no test submissions).
- No source maps are available; minified bundle names are used as evidence only.
- Reduced-motion testing covered the CSS animations only. The WebGL scene's behaviour under reduced motion was not checked.

---

## Screenshots

| File | What it shows |
|---|---|
| [screenshots/b-desktop-fold.png](screenshots/b-desktop-fold.png) | Home at 1440 × 900: the 3D tube cluster in its framed panel |
| [screenshots/b-tablet-fold.png](screenshots/b-tablet-fold.png) | Home at 820 × 1180 |
| [screenshots/b-mobile-fold.png](screenshots/b-mobile-fold.png) | Home at 390 × 844 |
| [screenshots/b-intro-300ms.png](screenshots/b-intro-300ms.png) | Loader at ~300 ms: progress bar and counter on black |
| [screenshots/b-intro-6000ms.png](screenshots/b-intro-6000ms.png) | Skewed panel with the 3D cluster, counter still near the end |
