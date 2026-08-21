# SEVERE brand video — reference analysis

Derived measurements only. No third-party reference footage or frames are
stored in this repo; these are numbers extracted from refs the user supplied
privately in conversation.

## Master format

- 1920 × 1440, 4:3, 24 fps, no audio.
- Safe areas (measured from the user's guide artboard, `03 - Artboard 13`):
  - 9:16 vertical  = centre **810 px** wide (x 555–1365) = 42.19% of width
  - 16:9 crop      = centre **1080 px** tall (y 180–1260) = 75% of height
  - both-safe intersection = **810 × 1080** centred
- Wordmark, city block and the "Come to us…" line stay inside 810×1080.
  Big letterform crops (S, SEV, ER) deliberately bleed past the frame.

## Copy (verbatim, locked)

    Come to us when nice stops working.
    London   /   New York   /   Detroit
    Deployed — Globally

## Cadence — the key finding

Effective (unique-frame) rates, measured by frame-differencing:

| ref            | source | unique frames | mean hold | effective |
|----------------|--------|---------------|-----------|-----------|
| TENDU (SR1)    | 60 fps | 112 / 227     | 2.03      | **29.6 fps** |
| SR2            | 60 fps |  42 / 194     | 4.62      | **13.0 fps** |
| Cosmos         | 24 fps |  50 / 105     | 2.10      | **11.4 fps** |
| BEAMS          | 30 fps | 119 / 120     | 1.01      | **29.8 fps** |

Typographic glitch runs **stepped at 11–13 fps** (on 2s), analog/VHS texture
runs **full rate**. Implement as two separate clocks:
- type + geometry: quantise t to 12 fps
- grain, static, chroma: regenerate every frame at 24 fps

## Tear / displacement (TENDU, 1422 px wide)

Per-row horizontal shift vs. a sharp reference frame, 1-D phase correlation:

- median row shift  **55 px = 3.9% of width**
- p95               **521 px = 36.6%**
- peak              **568 px = 39.9%**

Heavy-tailed: most rows barely move, a few contiguous bands displace enormously.
This is **block tearing, not a smooth wave**. Dominant vertical periods in the
displacement field: 1, 9 and 11 cycles over 792 rows → one full-frame split plus
bands ~**70–90 px tall**.

## Black flash rhythm (TENDU)

Black-frame runs at 60 fps source: 1,3,2,2,3,3,2,3,2,2,3,3,3
→ 13 flashes in 3.78 s = **one every ~0.29 s**, each **1–2 frames at 24 fps**.

## Grain (high-pass sigma, 0–255)

- TENDU  **2.70**  (subtle)
- BEAMS  **13.36** (heavy analog)
- Cosmos **0.57**  (essentially clean — its glitch is pure geometry)

Grain in this project comes from the still refs, not the motion refs.

## Colour

- Cosmos field measured **#F02010 / #E82008** — a warm red, NOT #FF0000.
  SEVERE uses **#FF0000 on #000**; do not drift toward the warm red.
- BEAMS global per-channel horizontal offset measured **0 px** — its blue
  fringing is **edge-local**, not a whole-frame RGB split. Chroma leak must be
  applied at high-contrast edges, weighted by local gradient, not as a global
  channel translate.

## Plates

Both B/W, tinted by **multiply with #FF0000** → `R = luma, G = 0, B = 0`.
Verified this reproduces storyboard boards 3/13 exactly.

Generation spec (revised — an earlier draft of this file asked for crushed
blacks and blown highlights, which was wrong):

- **Flat and unclipped.** Nothing at 0 or 255. Clipped regions are destroyed
  information; a flat plate can be expanded, lifted or crushed in post, and
  lets the eye plate, the tree plate and the pure-CG type boards share one
  black level. All grading happens here, not in the generator.
- **Maximum resolution / quality.** Expanding a flat image amplifies banding
  in smooth grey areas.
- **Heavy optical defocus, generated — not added in post.** A real lens blooms
  a highlight into a bright disc; a Gaussian blur of a sharp frame averages it
  into grey. Blur in post is for fine adjustment only, and must run in linear
  light so highlights bloom rather than dull. Defocus also suppresses the
  uncanny-iris failure mode in generated macro eyes.
- **Minimal native grain.** Grain is applied last, after all blur — blurring a
  grainy plate destroys the grain and it has to be re-added anyway.

## Source

`SEVERE__Storyboard.ai` — PDF-1.6, 23 pages: 22 boards at MediaBox 400×300
(4:3 exact) + one 2642×2144 guides artboard. Font: HaasGrotDisp-65Medium,
same family already in `assets/v3/fonts/`.


## Distortion vocabulary (revised after the Glitches / Type_glitches refs)

An earlier pass modelled the distortion as hard-edged random block displacement.
That is a *digital datamosh* look and it is wrong for this project. The
references are **analog tape**: soft, dragged, liquid.

Measured by tracing a stripe through TENDU frame 0009:

- **Serpentine warp** — a stripe wanders **±142px on a 1422px frame** (rms 70px,
  so ±10% of width). A single sine explains only **36%** of the excursion: it is
  summed octaves. Measured vertical periods 617 / 308 / 206 / 103px on a 792px
  frame → roughly frame-height and its /3, /6, /12 harmonics.
- **2D drag** — shapes smear into soft trailing streaks. The whole-screen
  reference pulls type into **vertical** streaks as often as horizontal ones.
- **Fine vertical comb** at ~6% modulation depth.
- **Narrow slices only** — 12–40px bands, a handful at a time. Never the whole
  frame, never thick bright bars (explicitly rejected by the user).
- **Fine horizontal line dither** — 1px lines on a 3px pitch, subtle.
- Soft edges throughout.

### Event cadence

The references are not continuously broken: TENDU and HOT TAKES both sit clean
for long stretches then corrupt for a few frames. Heavy effects are therefore
**discrete events**, generated deterministically:

- gap between events **1.50–3.05s**, mean **2.44s**
- duration **2–9 frames** at 24fps
- 12 events across the 31s film
- envelope snaps in and decays as `(1-u)^0.6` — glitches do not ease

Only grain, fine lines, a trace of warp and a slow focal gradient run
continuously underneath.

### Type corruption (HOT TAKES reference)

During an event only: the word duplicates into 2–3 copies, each offset up to
300 × 240px, some skewed up to 0.40, ghosts at 0.28–0.73 alpha, plus a
60–320px horizontal band sliced out and shifted up to 420px sideways.

### Focal field (blur references)

Not a uniform blur — a **smooth focal gradient** across the frame in an
arbitrary direction, one side sharp and the other soft (SEVE defocused while RE
is not; the S sharp left and soft right). Implemented as
`blur = base + amp · smoothstep(dot(uv-0.5, dir))`, direction rotating on a
2.7s clock.

### Stable layer

The dot must never move. It is drawn to a **separate canvas that the distortion
never touches** and composited after warp, drag and slice — verified locked at
(959.6, 719.5) / (959.9, 719.7) / (959.3, 719.3) across frames, against a frame
centre of (960.4, 720.4) measured from the .ai.


## Corrections after the second review pass

**Plate grade — shadow crush.** Putting the black point on the plate's own
minimum crushed **55.4% of the eye's dark region to pure 0**, which read as a
flat, hard-edged cut-out ("weird threshold effect"). The plate has nothing below
16, so the black point is now left at 0 and only the highlights are compressed:
range 22–250, **0.00% crushed, 0.00% blown**, and the dark region keeps sd 14.6
against the raw plate's 11.3.

**Grain — too contrasty.** Per-pixel white noise measured neighbour correlation
**-0.377** against the TENDU reference's **-0.174**: far harsher than the
reference. Grain is now value noise on a **1.10px cell**, smoothly interpolated,
amplitude 0.26 → **sd 10.6/255, correlation -0.194**. Softer than the previous
16.7 and clumped like real grain. The hard white speckle pass was removed
entirely.

**Comb — wrong axis emphasis and far too weak.** Measured on TENDU: the striping
is **vertical** (column variation 63 vs row variation 8.6), period **3.79px on a
1422px frame** (5.12px at this master) at **8.4% of local level**. It was running
at 3px and 2.5%.

**Slice displacement removed.** The 12–40px band displacement was what produced
the wide horizontal bars the user rejected. Deleted; the vertical comb, 2D drag
and type corruption carry the glitch instead.

**Letterforms are never warped.** Boards carrying big type set `noWarp`, which
zeroes the serpentine warp after events are applied. Type is corrupted only by
duplication, offset, skew, ghosting and sliced bands.
