# SEVERE™

Website for the SEVERE studio. Static site — plain HTML, CSS and ES modules, no build step.

**Live:** https://fpomykalo.github.io/severe/ (GitHub Pages, deploys from `main` automatically on every push)

## Versions

| Version | Page | Status |
| --- | --- | --- |
| **v3** | [`v3.html`](v3.html) | **Active** — current SEVERE design (Figma "SEVERE™ — Web", Home 1–5) |
| v2 | [`v2.html`](v2.html) | Frozen — previous "sub rosa" design |
| v1 | [`index.html`](index.html) | Frozen — original "sub rosa" design |

## Structure

```
v3.html             v3 markup
css/style3.css      v3 styles
js/main3.js         v3 logic (intro reveal, image pool, overlay, personnel accordion)
assets/v3/          v3 assets
  fonts/            Haas Grot Disp 65 Medium + 75 Bold (woff2 for the site, otf source)
  images/f/ z/      fullscreen background image pool (3840×2160 JPGs)
  svg/              wordmark, ™, arrows, close X

index.html, v2.html, css/, js/, vendor/   v1 + v2 code (frozen)
assets/v1-v2/                             v1 + v2 assets (fonts, images, SVGs)
```

## Local development

```
python3 -m http.server 8321
# open http://localhost:8321/v3.html
```
