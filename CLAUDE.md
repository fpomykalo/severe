# sub rosa — project context for Claude

Single-page portfolio site for the sub rosa studio, built 1:1 from Figma
(`TheStudio V1`, file key `mFJgS92aoDKCxCKYaNztju`, page "Page 3.4").
Static site, no build step: plain HTML/CSS/ES modules at the repo root.

- **Live site:** https://fpomykalo.github.io/the-studio/ (GitHub Pages, deploys
  automatically from `main` root on every push — always push finished work to
  `main`)
- **Figma frames:** Home 3 (desktop intro) → Home 2 (desktop main) → Home 4
  (desktop showcase overlay); iPhone 16 - 1..5 (mobile: intro, main expanded,
  menu overlay, showcase, collapsed header). Cross-reference Figma when the
  user says they changed something there.

## Structure

```
index.html          all markup + copy (scene1, morph, scene2, showcase, menu)
css/style.css       type/positions; mobile media query at max-width 600px
js/main.js          orchestration: scroll morph, write-on/out timeline,
                    fitTitle layout engine, clocks, showcase, mobile header
js/textpool.js      canvas text-pool effect (pretext layout + spring physics)
js/halftone.js      WebGL2 halftone-reveal (ported from react-bits) + cycling
vendor/pretext/     @chenglou/pretext 0.0.8 dist (MIT), do not modify
assets/             rose SVGs (exported byte-exact from Figma), Geist woff2
                    (self-hosted), showcase images in assets/images/
```

## How the site works

- **Intro → main:** scroll drives a 180° Y-axis flip of the rose illustration
  into the corner logo (`#morph` is the resting logo). One master timeline
  (`W` in main.js) drives every typewriter and canvas pool; desktop scrolling
  back plays it in reverse. On mobile the intro is one-way: after the morph,
  `introLocked` collapses the intro scroll region until a page refresh.
- **fitTitle() is the layout engine.** Everything in the header derives from
  it. Desktop rules: sub's ink anchors on the kito column rail; rosa's ink
  spans exactly the last two columns (zivan+noah incl. 16px gap) which sets
  the uniform title scale; nav row 20px under the title; London on the r's
  ink; Manifesto+/® right-aligned at vw-80; headline 40px under the Latin
  block on sub's rail. Mobile rules: ink rails at 20px; rosa ink spans
  vw-40; header collapses (expanded 16-2 ↔ collapsed 16-5) over the first
  200px of scroll via `applyMobileHeader(c, scope)`; showcase mirrors the
  current collapse state in white.
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
