# sub rosa — project context for Claude

Single-page portfolio site for the sub rosa studio, built 1:1 from Figma
(`TheStudio V1`, file key `mFJgS92aoDKCxCKYaNztju`, page "Page 3.4").
Static site, no build step: plain HTML/CSS/ES modules at the repo root.

- **Live site:** https://fpomykalo.github.io/the-studio/ (GitHub Pages, deploys
  automatically from `main` root on every push — always push finished work to
  `main`). **v2 lives at /v2.html** — a full fork kept beside v1 on the same
  branch so the initial version is never lost. Active work happens on v2;
  don't touch the v1 files (index.html, style.css, main.js, textpool.js).
- **Figma frames:** Home 3 (desktop intro) → Home 2 (desktop main, now FOUR
  columns) → Home 4 (desktop showcase overlay) → Home 6/7 (desktop manifesto,
  expanded/collapsed header); iPhone 16 - 1..6 (mobile: intro, main expanded,
  menu overlay, showcase, collapsed header, manifesto). Cross-reference Figma
  when the user says they changed something there.

## Structure

```
index.html          v1 — frozen snapshot of the initial version
css/style.css       v1 styles (frozen)
js/main.js          v1 orchestration (frozen)
js/textpool.js      v1 text pool (frozen)
v2.html             v2 markup: scene1, morph, scene2 (4 columns), showcase,
                    manifesto overlay, menu
css/style2.css      v2 styles (name links, manifesto, 4-col grid)
js/main2.js         v2 orchestration: + manifesto page, name links,
                    desktop header collapse, no rose cursor
js/textpool2.js     v2 pool: first N words static (DOM links, no physics)
js/halftone.js      WebGL2 halftone-reveal (shared by v1 and v2) + cycling
vendor/pretext/     @chenglou/pretext 0.0.8 dist (MIT), do not modify
assets/             rose SVGs, Geist woff2 (self-hosted), showcase images in
                    assets/images/. v2 logo: assets/rose-logo2.svg +
                    rose-logo2-white.svg (recolored #262626/#fff copies of
                    the user-uploaded assets/svg/rose-logo 2.svg, 41.4:50 —
                    narrower than v1's 66:50; morph end boxes are
                    {80,55,41×50} desktop / {20,20,30×36} mobile)
```

## How the site works

- **Intro → main:** scroll drives a 180° Y-axis flip of the rose illustration
  into the corner logo (`#morph` is the resting logo). One master timeline
  (`W` in main.js) drives every typewriter and canvas pool; desktop scrolling
  back plays it in reverse. On mobile the intro is one-way: after the morph,
  `introLocked` collapses the intro scroll region until a page refresh.
- **fitTitle() is the layout engine.** Everything in the header derives from
  it. v1 desktop rules (5 cols): sub's ink anchors on the kito column rail;
  rosa's ink spans exactly the last two columns which sets the uniform title
  scale. v2 desktop rules (4 cols — kito/filip/zivan/noah at 80/404/728/1052,
  308 wide at 1440): sub's ink anchors on the SECOND column rail (filip);
  rosa's ink ends at vw-80; the composition's 960px natural ink span
  (TITLE_SPAN, sub ink start → rosa ink end at 240px, rosa box offset 489
  from sub's) sets the scale — s≈1.0 at 1440, matching Figma. Both: nav row
  20px under the title; London on rosa's ink; Manifesto+/® right-aligned at
  vw-80; headline 40px under the Latin block on sub's rail. Mobile rules:
  ink rails at 20px; rosa ink spans vw-40; header collapses (expanded 16-2 ↔
  collapsed 16-5) over the first 200px of scroll via
  `applyMobileHeader(c, scope)`; showcase mirrors the current collapse state
  in white.
- **v2 manifesto (Home 6/7, iPhone 16-6 + user revisions):** `Manifesto+` (or
  the mobile menu) opens `#manifesto` — a fixed, self-scrolling overlay (z15,
  under showcase z20/menu z40) with fixed header elements and a black
  #mf-mask. Desktop: the header collapses over the first 200px of overlay
  scroll into a one-line "sub rosa" (cap height 62 at top 43, rosa box
  offset 458·s2, nav row rises navTop→125); content = gray headline (as
  Home 2), body Geist 400 16/24 ls-0.32 white, width = two columns + gutter
  (632 at 1440) on the filip rail, starting 104px under the headline (y434
  at 1440); "top of the page ↑" 70px under the body (smooth scrolls back
  up), 104px bottom padding. The mono label "the manifesto / last
  updated:…" (x80) and the white 55px X (right edge vw-80) are FIXED
  (z3, above the mask): they ride up with the content until 50px under the
  header block (navTop+latinH+50), then lock there while the body scrolls
  under the mask — user-specified sticky behavior overriding Home 6's
  scrolling X. Mobile: same collapse mechanic as the homepage (opens
  EXPANDED 16-2 state, collapses over 200px of overlay scroll — overrides
  16-6's always-collapsed frame per user note); label pinned
  navTop(c)+26+50, X right edge vw-20 centered on the label
  (top=label−19), body 14/20 ls-0.28 at label+16+70; mobile mask extends to
  labelTop+56 (past the pinned X) because the body is full-width. Esc
  priority: showcase → menu → manifesto. X is fixed, so it closes from any
  scroll depth.
- **v2 founder names are DOM links** (`.name-link`, textpool2 `staticWords`):
  the first name+surname words are skipped by the canvas draw/physics and
  rendered as real `<a>`s over the pool (8px Geist Mono uppercase white).
  Baseline alignment is measured at runtime with a zero-size inline-block
  marker probe (marker top − probe top = DOM baseline offset; link top =
  canvas hy − offset) — browser/zoom/DPR-independent, no text-box
  dependency. Hover underlines; each word reveals with the master timeline
  like canvas words (`syncNameLinks`). Real LinkedIn URLs (user-provided):
  kkitev, filip-pomykalo, zivanrosic, noahjoelsmith. v2 has NO rose cursor —
  default cursor; body copy still stirs (textpool listens on its own canvas;
  #cols pointermove just wakes the pool loop).
- **v2 column copy (short version, Aug 2026 Figma):** each column = name +
  TWO paragraphs from P_LONG ("Brand is infrastructure…Nokia.") and P_BIO
  ("Brand designer…left the room."). kito/zivan: [P_LONG, P_BIO_CUT] where
  P_BIO_CUT ends mid-sentence at "…once he." (verbatim in Figma — don't
  "fix" it); Filip/noah: [P_BIO, P_LONG]. Figma capitalizes "Filip
  Pomykalo"; pool renders uppercase regardless.
- **Showcase video reel (prepared, awaiting asset):** halftone.js accepts
  `opts.video` (single URL) — a muted looping `<video>` uploads every frame
  to the GL texture, lens/dots identical, no cycling; images path untouched
  (v1 unaffected). main2.js `SHOWCASE_VIDEO` is null until the user
  delivers the reel — set it to the asset path (and add the file to the
  repo) to switch the showcase from stills to the reel.
- **Ink metrics are pixel-calibrated constants** (`rosaInkOffset=16`,
  `subInkOffset=9`, `rosaInkW=464` at 240px): canvas measureText cannot see
  the ss01/ss04 alternate glyphs, so don't "fix" these back to measured
  values. Alignment is always to glyph INK, not the text box.
- **Text pools:** five founder columns render on canvas, laid out DOM-free by
  vendored pretext (pre-wrap keeps the ten-space name gaps). Words are
  spring particles; the cursor (rose logo, desktop only) stirs a lingering
  wave and disturbed words go transparent. Desktop: fluid widths, fixed 16px
  gutters, bottom edge 30px above the viewport. Mobile: stacked full-width,
  40px apart, page scrolls under a black header mask.
- **Showcase:** `showcase+` (or the mobile menu) opens fullscreen WebGL
  halftone (#1A1A1A dots on black — an intentional color, not a stray gray);
  the lens around the cursor reveals the true image; images cycle in
  shuffled order every ~140ms while the pointer moves; radius is scaled down
  on portrait screens. X closes (desktop: 20px under nav links; mobile:
  bottom-centered with the drag hint 30px above).
- **Colors:** all gray UI elements are #262626 (wordmark, ®, headline, logo
  fill). Body copy stays #404040 with white names. Selection #FFC252.
- **Known Chromium trap:** `text-box: trim-both` + `<br>` + incremental text
  mutation causes a stale-layout line jump — that's why the headline is three
  separate single-line elements. Don't merge them back.

## Workflow conventions

- Test with Playwright against `python3 -m http.server` using the
  pre-installed Chromium (`/opt/pw-browsers/chromium-*/chrome-linux/chrome`,
  add `--use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL).
  Verify layout rules numerically (getBoundingClientRect) and visually
  (screenshots at 1440×900 and 393×852) before pushing.
- Commit + push to `main` when a change is verified; Pages redeploys itself.
- A shareable single-file preview also exists as a Claude artifact
  (fonts/SVGs/images inlined as data URIs, images downscaled to fit) —
  rebuild it with esbuild + the inline script if the session has one.
