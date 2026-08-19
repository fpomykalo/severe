# SEVERE — project context for Claude

Site for the SEVERE studio (repo `fpomykalo/severe`). Static site, no build
step: plain HTML/CSS/ES modules at the repo root.

- **Live:** https://fpomykalo.github.io/severe/ (GitHub Pages, deploys from
  `main` root on every push — always push finished work to `main`).
- **v3 is the active version** at `/v3.html` — the SEVERE design, built 1:1
  from Figma **"SEVERE™ — Web"** (fileKey `sCy8IEBBk0pDV7BCy3bE4C`, page
  node 2327:2783). Desktop frames **Home 1–4** (Home 4 = the single overlay
  frame, N. Smith expanded; Home 6/7 are obsolete 10px copies the user keeps
  for their record). Mobile frames **iPhone 16 - 7..12**.
- **v1 (`index.html`) and v2 (`v2.html`) are the old "sub rosa" site and are
  FROZEN — never touch them.** Their assets live in `assets/v1-v2/`;
  `js/halftone.js` + `vendor/pretext/` belong to them. Repo will eventually
  be cleaned down to v3 and exported to a new repository.

## v3 structure

```
v3.html            markup: bg image, dim, cities/clock, wordmark, nav,
                   overlay (3 columns), intro (hero lockup + scroll arrow)
css/style3.css     all layout; mobile ≤700px via one media query
js/main3.js        scramble engine, morph, image pool, overlay, accordion,
                   live clocks
assets/v3/fonts/   HaasGrotDisp-65Medium / -75Bold (woff2 + otf source)
assets/v3/images/  f/f01..f17.jpg + z/z01..z21.jpg — one shuffled pool
assets/v3/svg/     tm.svg (7×3), x.svg (26×26), x-m.svg (47×47),
                   arrow-scroll.svg (12×20 intro ↓), arrow-down.svg (5×9
                   "open" ↓) + arrow-down-m.svg (6×10), arrow-up.svg (7×7
                   external ↗) + arrow-up-m.svg (8×8),
                   severe-wordmark.svg (outline lockup, reference only)
```

## Design rules (Figma-exact, don't drift)

- **Color:** `#FF0000` on `#000`. Inactive overlay columns opacity 0.3,
  inactive bottom nav 0.2, clock line 0.3. All copy uses typographer's
  apostrophes (’ never ').
- **Grid (desktop 1440):** 6 columns, 20px margins, 16px gutters →
  `--cw:(100vw-120px)/6` (220). Rails: wordmark `25vw+8` (368), manifesto
  `50vw+8` (728), personnel `66.667vw+4` (964), inquire `83.333vw` (1200).
  Personnel sub-column: rail + `(cw+16)/2` (1082). Nav baselines 20px above
  bottom; X 26×26 at right/bottom 20.
- **Type:** 'HaasDisp' (500 = 65 Medium, 700 = 75 Bold). Cities/clock 10px.
  Overlay text 12px with **line-height 14px** (Figma uses explicit 14, not
  the 14.4 the font's normal would give). Nav + wordmark 36px (no tracking).
  Hero 363px, tracking −3.63px, first-E span +0.16px. All text cap-aligned
  via `text-box: trim-both cap alphabetic`. Font: upm 1000, cap 715 → cap
  is 8.577px at 12px; Figma's layout uses integer coordinates from a
  rounded 9px cap box, so flow gaps carry the remainder: `.p-link`
  margin-top 5.42px, `.p-sub` padding-bottom 19.42px, bio margin-bottom
  19.42px. Don't "clean up" these fractions.
- **Home 1 (intro):** hero is #hero-lockup in design units (S ink at 0,0,
  cap box 1416×260; word at −6px, ™ at 1389.04/0.55 w26.96), positioned by
  a JS transform: desktop `translate(11k,63k) scale(k)` (k=vw/1440), mobile
  rotated −90° scaled 0.51554 centered at (50%+0.42, 50%−2). Cities 20/20
  + clock 20/32 (mobile 16/16, 16/28), live London + Detroit HH:MM.SS,
  second clock offset measured from "22:04.37"+20 spaces. ↓ arrow 12×20
  centered, 20 (16 mobile) from bottom.
  **Reveal:** staggered Random Character Offset — hero letters appear one
  after another (i·90ms) while already-visible slots keep cycling (45ms
  flips), settle L→R; cities and both clocks reveal per-character the same
  way. **There is no page scroll/scrollbar** (body overflow hidden).
- **Intro → main morph:** first wheel-down / swipe-up / ArrowDown triggers
  a one-way 900ms ease morph: the lockup shrinks and travels into the
  header wordmark spot (letter-spacing lerps −3.63→0 so it lands exactly on
  the 36px wordmark; ™ lerps separately to its 7×3 box at +141), while the
  three nav items write themselves out with the same scramble. States:
  body[data-state=intro→morph→main]; at main the real #wordmark swaps in.
- **Home 2/3:** pointer movement cycles the fullscreen pool (swap per
  140ms of movement, object-fit cover, no effects). Images are decoded
  ahead (`img.decode()`, decoding=async, next-2 prefetch) — never swap
  undecoded 3840px JPEGs (main-thread decode jank).
- **Overlay:** click nav → body.overlay + data-tab. Image freezes, blur
  7.5px (user spec "blur 15" = Figma diameter) + scale(1.03) + **80% black
  dim**. Labels top 20 on the rails (no offsets); rules/borders stroke at
  [48,49] (Figma line y49 draws upward); first text cap +5 under the line
  (54). Active label "Name ↓" (5×9), inactive "Name +".
  **Interactions:** clicking the active nav item or active top label
  toggles the overlay closed; clicking empty screen (anything that isn't
  column text/X/nav) closes; clicking any column's content activates that
  column's tab; switching tabs collapses any open personnel row; Esc
  closes. ALL links underline on hover (nav items, top labels, names,
  LinkedIn, email).
- **Personnel column:** rows are content-driven (no fixed pitch): name cap
  +5 from stroke; right sub-column title (K. Kitev's "Director
  of/Operations" is a hard 2-line break on desktop, one line on mobile —
  .ttl-d/.ttl-m spans); LinkedIn cap = title cap + lines·14; next stroke =
  LinkedIn cap + 28. Accordion (one open): bio cap = LinkedIn cap + 29,
  next stroke = bio bottom + 19.42. Permanent Associates (static): label
  +5, entries +34/+91, links +62/+119, height 128. LinkedIn ↗ 7×7 at
  text+48; email ↗ at +97. URLs: kkitev, filip-pomykalo, zivanrosic,
  noahjoelsmith, philipdeguzman, cody-duma-92439780.
  **K. Kitev's bio is a placeholder (copy of N. Smith's).** FP + ŽR bios
  are user-provided (Aug 2026); NS from Figma.
- **Mobile (≤700px, frames at 393):** margins 16. Wordmark 16/67. Main
  nav = stacked 66px items at 16/137/204/271. Open section: active title
  at 137, others hidden, X 47×47 at right 16/top 137, rule at 16/227 full
  width, content 14px with **line-height 15px** scrolling under the fixed
  rule (col is the scroll container, border-top = the rule, first p-row
  drops its border). Rows: text +10 under lines, sub-column at left
  +193.63, gaps 5/20 as desktop. Manifesto body +15 under rule; email +10,
  ↗ 8×8 at +112. Note: Figma iPhone-10/11 have inconsistent F.P./Ž.R. row
  gaps (7/20 vs the 20 rule) — implemented with the uniform rule instead;
  flagged to the user.
- **Manifesto column:** Figma copy, 5 paragraphs, blank line between
  (pre-wrap \n\n), cap 54 under the 48/49 stroke.

## Workflow conventions

- Cross-reference Figma (get_metadata on 2327:2783 + get_design_context)
  whenever the user says they changed something there. get_metadata
  collapses whitespace in text — use get_design_context for line breaks.
- Figma asset URLs are NOT curl-able through the egress proxy; export
  vectors via use_figma `exportAsync({format:'SVG_STRING'})`.
- Test with Playwright against `python3 -m http.server 8321` (start it
  `cd /home/user/severe && nohup python3 -m http.server 8321 & disown`),
  Chromium at `/opt/pw-browsers/chromium-*/chrome-linux/chrome`
  (`--use-angle=swiftshader --enable-unsafe-swiftshader` for v1/v2 WebGL).
  Verify numerically (getBoundingClientRect vs the rules above) AND
  visually at 1440×900 and 393×852. NOTE: under SwiftShader the blur/dim
  transitions repaint slowly — wait ≥1.5s after opening the overlay before
  reading computed opacities.
- The user sometimes uploads via the GitHub web UI — always fetch+merge
  origin/main before pushing. Commit messages describe the change, no
  model IDs. Pages redeploys on push (verify via GitHub MCP actions_list;
  output overflows — parse the saved JSON with python).
