# sub rosa — TheStudio V1

Single-page site built from the Figma file `TheStudio V1` (frames **Home 3** → **Home 2**, 1440×900 reference).

No build step — static files. Serve the folder with any static server:

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

## How it works

- **Initial load (Home 3)** — the rose illustration (416×412) sits dead-center in the viewport with the `sub rosā` caption beneath it, exactly as in Figma.
- **Scroll morph** — scroll drives a 180° rotation around the vertical axis. The illustration shows for the first 90°, goes edge-on, and the rose logo (pre-rotated 180°) is revealed for the second 90° while the whole element translates and scales into the logo's Home 2 position (80, 55, 66×50). Reversible — scrolling back plays it backwards.
- **Write-on (Home 2)** — once the morph completes, every text element on the page is written out character-by-character (staggered typewriters over the real DOM text nodes), and the four founder columns write out word-by-word on canvas. The London / New York clocks are live.
- **Text pool** — the founder body copy is rendered on `<canvas>` and laid out DOM-free with [`@chenglou/pretext`](https://github.com/chenglou/pretext) (vendored in `vendor/pretext/`, layout via `prepareWithSegments` + `layoutWithLines`). Every word is a spring-mass particle anchored at its laid-out position. The cursor (which becomes the rose logo over the columns) transfers its velocity plus a radial push to nearby words; low spring stiffness and low damping produce the lingering wave, and per-word "heat" makes disturbed words **more transparent** while the wave passes — the inverse of the pretext text-pool demo at [pretextjs.dev/pretext-demo/showcase-text-pool](https://pretextjs.dev/pretext-demo/showcase-text-pool), where resting text is light and darkens under the cursor. Tuning constants are at the top of `js/textpool.js`.

- **Showcase (Home 4)** — the `showcase+` link under `Manifesto+` opens a fullscreen overlay: the work images render as a halftone print (#1A1A1A dots on black) and the area around the cursor resolves into the full-colour raster through a soft-edged lens, ported from react-bits' [Halftone Reveal](https://reactbits.dev/animations/halftone-reveal) (ogl → raw WebGL2; dotDensity 100, dotSize 0.8, contrast 1, revealRadius 0.6, edge 0.9, follow 0.1). Moving the cursor swaps in a random other image from `assets/images/` every ~180px of travel. The × in the upper right (or Escape) closes it.
- **Write-out** — scrolling back up plays the whole write-on timeline in reverse while the rose flips back to centre.

## Structure

```
index.html          page + all copy
css/style.css       Figma-mapped positions/typography (text-box: trim-both cap alphabetic)
js/main.js          scroll morph, write-on/write-out timeline, clocks, showcase, orchestration
js/textpool.js      canvas text-pool effect (pretext layout + spring physics)
js/halftone.js      WebGL2 halftone-reveal (ported from react-bits) + image cycling
vendor/pretext/     @chenglou/pretext 0.0.8 dist (ES modules, MIT)
assets/             the two rose SVGs (exported from Figma) + Geist/Geist Mono woff2
```

Fonts are self-hosted (`geist` npm package — the same faces Google Fonts serves), so the page works offline; swap in the Google Fonts `<link>` if preferred.
