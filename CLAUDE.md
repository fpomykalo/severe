# SEVERE — project context for Claude

Site for the SEVERE studio (repo `fpomykalo/severe`). Static site, no build
step: plain HTML/CSS/ES modules at the repo root.

- **Live:** https://fpomykalo.github.io/severe/ (GitHub Pages, deploys from
  `main` root on every push — always push finished work to `main`).
- **v3 is the active version** at `/v3.html` — the SEVERE design, built 1:1
  from Figma **"SEVERE™ — Web"** (fileKey `sCy8IEBBk0pDV7BCy3bE4C`, page
  "Page 3.4" node 2327:2783), desktop frames **Home 1–5**. Mobile frames are
  intentionally ignored for now.
- **v1 (`index.html` + css/style.css + js/main.js + js/textpool.js) and
  v2 (`v2.html` + css/style2.css + js/main2.js + js/textpool2.js) are the
  old "sub rosa" site and are FROZEN — never touch them.** `js/halftone.js`
  and `vendor/pretext/` belong to v1/v2. Their assets live in
  `assets/v1-v2/` (moved there Aug 2026; all v1/v2 files reference that
  path). The repo will eventually be cleaned down to v3 and exported to a
  new repository.

## v3 structure

```
v3.html            markup: bg image layer, dim, cities/clock, wordmark, nav,
                   overlay (3 columns), intro hero
css/style3.css     all layout (CSS-only responsive rules, see grid below)
js/main3.js        scramble reveal, one-way intro scroll, image pool,
                   overlay/tab state, personnel accordion, live clocks
assets/v3/fonts/   HaasGrotDisp-65Medium / -75Bold (woff2 site + otf source)
assets/v3/images/  f/f01..f17.jpg + z/z01..z21.jpg (renamed from the user's
                   f-3840x2160 / z-3840x2160 uploads), one shuffled pool
assets/v3/svg/     severe-wordmark.svg (outline lockup, reference only),
                   tm.svg (7×3), x.svg (26×26), arrow-down.svg (4×7, "open"
                   marker), arrow-up.svg (5×5 external-link ↗ used on
                   LinkedIn/email despite the name)
```

## Design rules (Figma-exact, don't drift)

- **Color:** everything is `#FF0000` on `#000`. Dim states are *element
  opacity*, not different reds: inactive overlay columns 0.3, inactive
  bottom-nav items 0.2, clock line 0.3. Selection red-on-black inverted.
- **Grid:** 6 columns, 20px viewport margins, 16px gutters →
  `--cw:(100vw-120px)/6` (220 @1440). Rails: wordmark `25vw+8` (368),
  manifesto `50vw+8` (728), personnel `66.667vw+4` (964), inquire
  `83.333vw` (1200). Right sub-column inside personnel: rail +
  `(cw+16)/2` (1082 @1440). All bottom/top/left/right text margins are 20px.
- **Type:** Haas Grot Disp, family 'HaasDisp' (500 = 65 Medium,
  700 = 75 Bold). Sizes: 10px UI/body, 36px nav + header wordmark,
  hero 363px @1440 (`25.20833vw`, letter-spacing −0.01em, first E span
  +0.16px/363 em — Figma kerning fix). ALL text is cap-aligned with
  `text-box: trim-both cap alphabetic`; font metrics: upm 1000, cap 715,
  asc 818, desc 182, lineGap 200 → line-height "normal" = 1.2 (12px @10px),
  matching Figma exactly.
- **Home 1 (intro):** hero at left 5px / cap-top 63px @1440, ™ svg at
  1400.04/63.55 w26.96 — whole lockup in vw units so it scales with the
  viewport. Letters scramble on load ("Random Letter/Character Offset
  Reveal"): 6 slots flip random chars every 45ms, settle L→R at
  600+i·160ms after fonts load. Cities line 20/20, clock 20/32 (live:
  Europe/London + America/Detroit, HH:MM.SS, second clock offset measured
  from the Figma string "22:04.37" + 20 spaces via canvas measureText).
- **Intro scroll is one-way:** 200vh spacer, hero translates up 1:1 with
  scroll; at scrollY ≥ vh → `body[data-state=main]`, spacer collapses,
  scroll locks. No way back (Figma: "that was just the loading screen").
- **Home 2/3:** wordmark (36 Bold + tm at +141px) top 20; nav
  Manifesto/Personnel/Inquire 36px Medium, baseline 20px above viewport
  bottom. Pointer movement cycles the fullscreen image pool (one image
  element, object-fit cover, swap every 140ms of movement, shuffled once,
  only already-preloaded images; preloading starts at page load).
- **Overlay (Home 4/5):** click any nav item → `body.overlay` +
  `data-tab`. Background image freezes, gets `filter: blur(10px)`
  (Figma layer-blur 20 = CSS radius 10) + scale(1.03) edge-bleed fix +
  90% black `#dim`. All three dropdown columns show; active column
  opacity 1, others 0.3; bottom nav active 1, others 0.2. Top labels:
  inactive "Name +", active "Name ↓" (arrow-down.svg, gap 2). Lines are
  1px #FF0000 borders; strokes sit at 41→42px (Figma line y42 draws its
  stroke upward). Close X 26×26 at right/bottom 20; Esc also closes.
  Column label quirk: manifesto label at rail+2 (Figma 730), others on
  rail exactly.
- **Personnel column:** rows K. Kitev / F. Pomykalo / Ž. Rosić / N. Smith,
  39px pitch (border 1 + head 38): name cap +5 from stroke, title cap +5
  on sub-column, LinkedIn +17 (↗ 5×5 at text+40, top = cap top).
  Accordion: one open max; open row swaps "+" for ↓; bio (10px, w=cw)
  cap at stroke+41 (margin 3), next stroke at bio bottom +14
  (Figma Home 5: bio 200..423, next line 437-438). Permanent Associates
  section (not expandable): label +5, P. de Guzman +27, LinkedIn +51,
  C. Duma +73, LinkedIn +97 (offsets inside padding box).
  LinkedIn URLs: kkitev, filip-pomykalo, zivanrosic, noahjoelsmith,
  philipdeguzman, cody-duma-92439780.
  **K. Kitev's bio is a placeholder (copy of N. Smith's) — swap when the
  user provides the real one.** FP + ŽR bios are real (user-provided,
  Aug 2026); NS bio is from Figma.
- **Inquire column:** info@severe.work (mailto) + ↗ at text+81; underline
  on hover only.
- **Manifesto column:** body copy from Figma (5 paragraphs, blank line
  between = pre-wrap \n\n), cap at 47 under the 41-42 stroke.

## Workflow conventions

- Cross-reference Figma (get_metadata on 2327:2783, get_design_context on
  frames) whenever the user says they changed something there.
- Test with Playwright against `python3 -m http.server` using
  `/opt/pw-browsers/chromium-*/chrome-linux/chrome`
  (`--use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL in
  v1/v2). Verify numerically (getBoundingClientRect vs the rules above)
  and visually (1440×900 screenshots) before pushing.
- The user sometimes uploads via the GitHub web UI — always fetch+merge
  origin/main before pushing.
- Commit + push to `main` when verified; Pages redeploys itself.
