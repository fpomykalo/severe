// SEVERE — brand video render surface.
//
// Deterministic, frame-indexed renderer. Nothing here reads the wall clock:
// window.__render(n) fully describes frame n, so the harness can step at its
// own pace and the output is identical on every run.
//
// Two clocks, per the reference analysis:
//   - type and geometry step at 12 fps (the measured cadence of the
//     typographic glitch references: Cosmos 11.4, SR2 13.0)
//   - grain, static and chroma regenerate every frame at 24
// That mismatch is most of why glitch typography reads as digital.

const W = 1920, H = 1440, FPS = 24, STEP_FPS = 12;

// Safe areas measured from the user's guide artboard (03 - Artboard 13).
const SAFE_V = { x: 555, w: 810 };    // 9:16  — 42.19% of width, centred
const SAFE_H = { y: 180, h: 1080 };   // 16:9  — 75% of height, centred

const RED = '#FF0000';
// Not pure black. The graded plates floor at 22/255, and matching the ground to
// that does two things: type boards sit at the same black level as footage
// boards, and grain stops being half-rectified — on a 0 ground only the positive
// excursions survive, which is what makes it read as speckle rather than grain.
const GROUND = 'rgb(22,22,22)';
// Measured off the storyboard .ai: 4.02pt on a 400.2pt board = 19.28px at the
// 1920 master. The dot is the same size wherever it appears.
const DOT_D = 19.3;

const COPY = {
  line:   'Come to us when nice stops working.',
  cities: 'London   /   New York   /   Detroit',
  deploy: 'Deployed — Globally',
};

const src  = document.getElementById('src');
const ctx  = src.getContext('2d', { willReadFrequently: false });
// Stable layer: elements that must not be displaced by the distortion. The dot
// lives here — it sits at frame centre and holds there, whatever the tape does.
const srcB = document.getElementById('srcB');
const ctxB = srcB.getContext('2d', { willReadFrequently: false });
const gl  = document.getElementById('out').getContext('webgl2', {
  preserveDrawingBuffer: true, antialias: false, alpha: false,
});

// ---------------------------------------------------------------- plates

const plateCache = new Map();
const PLATE_LEN = 193;                // both plates are 193 frames @ 24fps

function plateSrc(kind, i) {
  const n = String(Math.min(PLATE_LEN, Math.max(1, i))).padStart(4, '0');
  return `../plates/${kind}/${n}.png`;
}

function loadPlate(kind, i) {
  const key = `${kind}/${i}`;
  if (plateCache.has(key)) return plateCache.get(key);
  const p = new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => img.decode().then(() => res(img), () => res(img));
    img.onerror = () => rej(new Error(`plate missing: ${key}`));
    img.src = plateSrc(kind, i);
  });
  plateCache.set(key, p);
  if (plateCache.size > 64) plateCache.delete(plateCache.keys().next().value);
  return p;
}

// Draw a plate frame scaled to cover the 4:3 frame, with an optional push-in.
function drawPlate(img, scale = 1, ox = 0, oy = 0, gain = 1) {
  const s = Math.max(W / img.width, H / img.height) * scale;
  const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, (W - dw) / 2 + ox, (H - dh) / 2 + oy, dw, dh);
  if (gain < 1) {                       // multiply by grey: pulls the highlights
    ctx.save();                         // down without lifting the blacks
    ctx.globalCompositeOperation = 'multiply';
    const v = Math.round(gain * 255);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// Multiply #FF0000 over the greyscale plate == (luma, 0, 0).
function tintRed() {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = RED;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ---------------------------------------------------------------- type

function setType(px, weight = 500, tracking = 0) {
  ctx.font = `${weight} ${px}px HaasDisp, sans-serif`;
  ctx.letterSpacing = `${tracking}px`;
}

function dot(x, y, color = RED, target = ctxB) {
  target.fillStyle = color;
  target.beginPath();
  target.arc(x, y, DOT_D / 2, 0, Math.PI * 2);
  target.fill();
}

// The vertical lockup: SEVERE rotated -90°, reading bottom-to-top, with ™.
function fitType(text, targetW, weight = 700) {
  let px = 100;                          // measure once, scale — the lockup is
  setType(px, weight);                   // specified by its length, not its size
  return px * targetW / ctx.measureText(text).width;
}

// Rotated -90deg the word reads bottom-to-top, so +x in rotated space is screen
// up and -y is screen left: the TM lands above and just left of the final E,
// which is where the guide artboard puts it.
function verticalWordmark(cx, cy, lengthPx, color = '#fff') {
  const px = fitType('SEVERE', lengthPx);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 2);
  setType(px, 700);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SEVERE', 0, 0);
  const w = ctx.measureText('SEVERE').width;
  setType(px * 0.22, 700);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('™', w / 2 + px * 0.05, -px * 0.315);
  ctx.restore();
}

// A single glyph blown up far past the frame, cropped by it — boards 5, 9, 10, 20.
function hugeGlyph(ch, px, x, y, color = RED, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  setType(px, 700);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, 0, 0);
  ctx.restore();
}


// ---------------------------------------------------------------- layout
//
// Every coordinate below is lifted straight from SEVERE__Storyboard.ai, whose
// boards are 400x300pt. PT converts board points to master pixels.

const PT = 1920 / 400;                 // 4.8
const BODY = 5.82 * PT;                // 27.9px — the storyboard's body size
const PITCH = 6.98 * PT;               // 33.5px — its line pitch

function label(text, xPt, yPt, { color = RED, size = BODY, dir = 0 } = {}) {
  ctx.save();
  ctx.translate(xPt * PT, yPt * PT);
  if (dir) ctx.rotate(dir);
  setType(size, 500);
  ctx.fillStyle = color;
  ctx.textAlign = dir ? 'center' : 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

const cityStack = (xPt, yPt) => {
  ['London', 'New York', 'Detroit'].forEach((c, i) =>
    label(c, xPt, yPt + i * 6.98));
};

// Writes a line out one character at a time. Progress is clamped, so passing a
// value past 1 simply leaves the finished line on screen.
function typeOut(text, xPt, yPt, progress, opts = {}) {
  const n = Math.round(Math.max(0, Math.min(1, progress)) * text.length);
  if (n > 0) label(text.slice(0, n), xPt, yPt, opts);
}

// A scripted burst for the transitions the storyboard calls for, as opposed to
// the random glitch schedule. Peaks at `at` and falls off over `width`.
const burst = (u, at, width) => Math.max(0, 1 - Math.abs(u - at) / width);

// The three blocks of copy, placed exactly where the .ai puts them. Boards
// 10-13 share this field; `full` adds the pair the denser boards carry.
// `write` staggers the eight blocks so the field types itself on rather than
// snapping in; pass 1 (the default) for the finished state.
function typeField(full, { color = RED, write = 1 } = {}) {
  const lines = [
    [COPY.line,   258.83, 208.96, 0],
    [COPY.cities, 270.27,  78.47, 0],
    [COPY.deploy, 244.20,  85.45, 0],
    [COPY.cities, 239.49, 244.14, 0],
    [COPY.deploy, 273.25, 251.28, 0],
    [COPY.cities,   7.78, 180.08, -Math.PI / 2],
    [COPY.deploy,  14.76, 237.44, -Math.PI / 2],
    [COPY.line,     8.86,  27.05, -Math.PI / 2],
  ];
  if (full) lines.push([COPY.line, 244.19, 41.43, 0]);
  lines.forEach(([txt, x, y, dir], i) => {
    const start = (i / lines.length) * 0.55;
    typeOut(txt, x, y, (write - start) / 0.45, { dir, color });
  });
  if (write > 0.55) dot(264.5 * PT, 80.6 * PT, color);
  if (write > 0.70) dot(234.0 * PT, 246.3 * PT, color);
}

// Record / pause / fast-forward, as they sit under the S on board 20.
function transportMarks(x, y, h, target = ctx) {
  const ctx = target;
  ctx.save();
  ctx.fillStyle = RED;
  ctx.beginPath(); ctx.arc(x + h * 0.4, y + h * 0.5, h * 0.4, 0, Math.PI * 2); ctx.fill();
  const px = x + h * 1.6;
  ctx.fillRect(px, y, h * 0.26, h);
  ctx.fillRect(px + h * 0.45, y, h * 0.26, h);
  const fx = x + h * 3.0;
  for (const o of [0, h * 0.62]) {
    ctx.beginPath();
    ctx.moveTo(fx + o, y); ctx.lineTo(fx + o + h * 0.55, y + h * 0.5); ctx.lineTo(fx + o, y + h);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// Horizontal lockup, specified by cap height and centre — the way the .ai
// measures it (board 16: 141.7px cap centred at 969,719).
function wordmark(cx, capMidY, capPx, color = RED, tm = true) {
  const px = capPx / 0.715;
  setType(px, 700);
  const w = ctx.measureText('SEVERE').width;
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const x0 = cx - w / 2, base = capMidY + capPx / 2;
  ctx.fillText('SEVERE', x0, base);
  if (tm) {
    setType(px * 0.22, 700);
    ctx.fillText('™', x0 + w + px * 0.03, base - capPx * 0.80);
  }
  ctx.restore();
}

// Boards 9 and 10 are the same lockup at two scroll positions. ctx.rotate(+90)
// makes the word read top-to-bottom with each glyph's spine turned to the top,
// which is what the .ai shows.
function hugeVertical(cx, wordTopY, capPx, color = RED) {
  const px = capPx / 0.715;
  ctx.save();
  ctx.translate(cx, wordTopY);
  ctx.rotate(Math.PI / 2);
  setType(px, 700);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('SEVERE', 0, 0);
  ctx.restore();
}

// A glyph placed by its cap box, so the huge crops land where the .ai has them.
function glyphAtCap(ch, fontPx, cx, capTopPx, color = RED, rot = 0) {
  ctx.save();
  ctx.translate(cx, capTopPx + fontPx * 0.715);
  if (rot) ctx.rotate(rot);
  setType(fontPx, 700);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(ch, 0, 0);
  ctx.restore();
}

// Trees run slower than life: the plate is real-time wind, played at 0.55x so
// the sway reads as the heavy, underwater movement the brief asks for.
const TREE_RATE = 0.55;
const treeFrame = (tb, offset) => Math.round((offset + tb * TREE_RATE) * FPS) + 1;

// Boards 9 and 10 are one continuous move, not two frames: the huge vertical
// lockup starts on S/E/V and climbs until E/R fills the frame. Sharing the
// travel between them keeps it from reading as a replacement cut.
const SEV_IN = 11.6, SEV_OUT = 13.3;

function lockupClimb(t) {
  const v = Math.max(0, Math.min(1, (t - SEV_IN) / (SEV_OUT - SEV_IN)));
  const y = -300 - 2400 * v;
  const x = 711 + 159 * v;
  glitchType(glitchAt(t), t, ({ dx = 0, dy = 0, skew = 0, alpha = 1 }) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.transform(1, 0, skew, 1, dx, dy);
    hugeVertical(x, y, 845);
    ctx.restore();
  }, 0.7);
}

// ---------------------------------------------------------------- timeline
//
// Boards are the storyboard frames, read row-major. Times in seconds at 24fps.
// `fx` returns the effect-stack parameters for that board; `draw` paints the
// 2D composite that the shader then chews on.

const stepped = (t) => Math.floor(t * STEP_FPS) / STEP_FPS;

// Deterministic hash — same one as the shader, so JS and GLSL agree.
function hash11(p) {
  p = (p * 0.1031) % 1; if (p < 0) p += 1;
  p *= p + 33.33; p *= p + p;
  return p % 1;
}

// The dot's blink schedule: deliberately uneven, accelerating into the eye.
const BLINKS = [
  [0.20, 0.34], [0.75, 0.89], [1.05, 1.19],
  [1.90, 2.04], [2.30, 2.60], [2.75, 3.00],
];
const dotOn = (t) => BLINKS.some(([a, b]) => t >= a && t < b);

// Black flashes at the TENDU rhythm: the reference throws one roughly every
// 0.29s, each lasting 1-2 frames at 24. The slot picks whether a flash happens;
// only the first frame or two inside that slot actually go black.
function blackFlash(t, rate) {
  if (rate <= 0) return false;
  const slot = Math.floor(t / 0.29);
  if (hash11(slot * 17.3) >= rate) return false;
  const frameInSlot = Math.floor((t - slot * 0.29) * FPS);
  return frameInSlot < (hash11(slot * 23.1) < 0.5 ? 1 : 2);
}

const BOARDS = [
  { // 1 — black, the dot starts blinking
    id: 1, start: 0.0, end: 3.0,
    fx: () => ({ boost: 0.7 }),
    async draw() {},
    drawStable(u, t) { if (dotOn(t)) dot(W / 2, H / 2); },
  },
  { // 2 — distortion, then the eye. Black and white, the dot still on it.
    id: 2, start: 3.0, end: 5.0,
    // The storyboard's own beat: the screen distorts, then the eye is there.
    // Scripted, not one of the random events.
    fx: (u) => {
      const enter = Math.max(0, 1 - u / 0.24);
      return { dragX: 110 * enter, dragY: 40 * enter,
               comb: 0.084 + 0.20 * enter,
               boost: 1.15 };
    },
    async draw(u, t, tb) {
      const img = await loadPlate('eye', Math.round(tb * FPS) + 1);
      drawPlate(img, 1.02, 0, 0, 0.82);
      dot(W / 2, H / 2);
    },
  },
  { // 3 — red, and the vertical wordmark for well under half a second
    id: 3, start: 5.0, end: 5.4,
    // The lockup is only up for well under half a second, so the tear punches
    // it in and out and leaves the middle clean enough to actually read.
    fx: (u) => ({ dragY: u < 0.3 ? 60 : 0, comb: u < 0.3 ? 0.24 : 0.084, boost: 0 }),
    async draw(u, t, tb) {
      const img = await loadPlate('eye', Math.round((2.0 + tb) * FPS) + 1);
      drawPlate(img, 1.02, 0, 0, 0.86);
      tintRed();
      // The lockup is on screen for well under half a second, so it always
      // arrives corrupted and settles, rather than waiting for a random event.
      // Only the scripted arrival corruption. A random event landing inside
      // this 10-frame board stacked a second, much harder glitch on top of it.
      const g = { amp: 0.6 * Math.max(0, 1 - u / 0.55) };
      glitchType(g, t, ({ dx = 0, dy = 0, skew = 0, alpha = 1 }) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.transform(1, 0, skew, 1, dx, dy);
        verticalWordmark(W / 2, H / 2, H * 0.62);
        ctx.restore();
      }, 0.42);
    },
  },
  { // 4 — red eye, the dot now white
    id: 4, start: 5.4, end: 6.6,
    fx: () => ({ boost: 1.0 }),
    async draw(u, t, tb) {
      const img = await loadPlate('eye', Math.round((4.0 + tb) * FPS) + 1);
      drawPlate(img, 1.02 + u * 0.06, 0, 0, 0.86);
      tintRed();
      dot(W / 2, H / 2, '#fff');
    },
  },
  { // 5 — into the S. The shape is big enough for the chroma leak to read.
    id: 5, start: 6.6, end: 8.2,
    // The S holds for 1.6s, so the tear escalates through it rather than only
    // punching the ends.
    // The S is the biggest shape in the intro, so events hit hardest here.
    // One-sided defocus: the focal gradient deepens hard, holds, and snaps
    // back, so only part of the letter goes soft — as in the blur references.
    fx: (u) => ({
      boost: 1.6, blurBase: 2,
      blurAmp: 78 * Math.max(0, Math.sin((u - 0.18) / 0.42 * Math.PI)),
    }),
    // Geometry measured off board 5 of the .ai: the visible red spans
    // 1849x1256px and is clipped at the bottom, which is a 2720px S with its
    // cap top at y=182, centred at x=951.
    // Starts 30% over the measured 2720px and settles at 15% over, so the size
    // change reads as a drift rather than a zoom. Scales about the centre of its
    // cap box, ease-out.
    async draw(u, t) {
      const k = 1.15 + 0.15 * Math.pow(1 - u, 2);   // 1.30 -> 1.15, a slight move
      const capMid = 182 + 2720 * 0.715 / 2;
      corruptGlyph(glitchAt(t), t, 'S', 2720 * k, 951,
                   capMid - 2720 * k * 0.715 / 2);
    },
  },
  { // 6 — back to black, the marker alone
    id: 6, start: 8.2, end: 8.9,
    fx: () => ({ boost: 0.8, sharp: true }),
    async draw() { label('S.', 177.40, 139.34); },
  },
  { // 7 — the cities arrive next to it
    id: 7, start: 8.9, end: 10.1,
    fx: () => ({ boost: 0.9, sharp: true }),
    async draw() { label('S.', 177.40, 139.34); cityStack(197.27, 139.34); },
  },
  { // 8 — the radial composition: Deployed / Globally on 45deg steps
    id: 8, start: 10.1, end: 11.6,
    fx: () => ({ boost: 1.0, sharp: true }),
    async draw(u) {
      label('S.', 177.40, 139.34); cityStack(197.27, 139.34);
      // The eight labels appear one at a time over the first half, then the
      // whole arrangement turns a single 45deg step, so each label ends on its
      // neighbour's mark: Globally lands where the top Deployed was.
      const rot = u * Math.PI / 4;
      for (let i = 0; i < 8; i++) {
        const appear = (i / 8) * 0.5;
        if (u < appear) continue;
        const a = i * Math.PI / 4 + rot;
        label(i % 2 ? 'Globally' : 'Deployed',
              200 + Math.cos(a) * 58, 150 + Math.sin(a) * 58, { dir: a });
      }
    },
  },
  { // 9 — SEV: the vertical lockup blown up and rotated 180deg, cropped
    id: 9, start: 11.6, end: 12.4,
    fx: () => ({ boost: 1.2 }),
    async draw(u, t) {
      lockupClimb(t);
      typeField(true, { write: (t - SEV_IN) / 1.5 });
    },
  },
  { // 10 — ER, with the copy stacked around it
    id: 10, start: 12.4, end: 13.3,
    fx: () => ({ boost: 1.2 }),
    async draw(u, t) {
      lockupClimb(t);
      typeField(true, { write: (t - SEV_IN) / 1.5 });
    },
  },
  { // 11 — the type field alone
    id: 11, start: 13.3, end: 14.4,
    fx: () => ({ boost: 1.0 }),
    async draw() { typeField(true); },
  },
  { // 12 — the trees, black and white
    id: 12, start: 14.4, end: 16.2,
    // The trees arrive the way the eye did: the screen breaks, then they are
    // there. Scripted, not one of the random events.
    fx: (u) => {
      const enter = Math.max(0, 1 - u / 0.16);
      return { dragX: 95 * enter, dragY: 35 * enter, comb: 0.084 + 0.18 * enter,
               boost: 1.1 };
    },
    async draw(u, t, tb) {
      drawPlate(await loadPlate('trees', treeFrame(tb, 0.4)), 1.03, 0, 0, 0.9);
      typeField(true);
    },
  },
  { // 13 — the same trees, red
    id: 13, start: 16.2, end: 17.8,
    fx: () => ({ boost: 1.0 }),
    async draw(u, t, tb) {
      drawPlate(await loadPlate('trees', treeFrame(tb, 1.39)), 1.03, 0, 0, 0.9);
      tintRed();
      typeField(true, { color: '#fff' });          // white over the red plate
    },
  },
  { // 14 — five white lockups down the 9:16 column
    id: 14, start: 17.8, end: 19.4,
    fx: () => ({ boost: 1.2 }),
    async draw(u, t, tb) {
      drawPlate(await loadPlate('trees', treeFrame(tb, 2.27)), 1.03, 0, 0, 0.9);
      tintRed();
      typeField(true, { color: '#fff' });          // the copy carries over
      // The middle lockup lands first; the pairs above and below duplicate out
      // of it rather than the whole stack arriving at once.
      const cx = SAFE_V.x + SAFE_V.w / 2;
      wordmark(cx, 46 + 2 * 311, 110, '#fff');
      if (u > 0.22) { wordmark(cx, 46 + 311, 110, '#fff');
                      wordmark(cx, 46 + 3 * 311, 110, '#fff'); }
      if (u > 0.42) { wordmark(cx, 46, 110, '#fff');
                      wordmark(cx, 46 + 4 * 311, 110, '#fff'); }
      transportMarks(SAFE_V.x + SAFE_V.w - 96, 108, 22);
    },
  },
  { // 15 — back to black and white, the stack alternating red and white
    id: 15, start: 19.4, end: 20.8,
    // The red drops away on a burst of static rather than a cut.
    fx: (u) => {
      const b = burst(u, 0.0, 0.10);
      return { boost: 1.2, comb: 0.084 + 0.55 * b, dragY: 70 * b, dragX: 40 * b };
    },
    async draw(u, t, tb) {
      drawPlate(await loadPlate('trees', treeFrame(tb, 3.15)), 1.03, 0, 0, 0.9);
      const cx = SAFE_V.x + SAFE_V.w / 2;
      // The middle lockup is gone from here on: it sat behind the copy block.
      for (const i of [0, 1, 3, 4]) {
        wordmark(cx, 46 + i * 311, 110, i % 2 ? RED : '#fff');
      }
      label(COPY.cities, 161.33, 135.97);
      label(COPY.deploy, 174.04, 142.95);
      label(COPY.line,   153.61, 156.91);
    },
  },
  { // 16 — the reveal. Cosmos treatment: the lockup multiplies, offsets and
    //      shreds on the 12fps step, over black.
    id: 16, start: 20.8, end: 22.8,
    fx: () => ({ boost: 1.5 }),
    async draw(u, t) {
      // The lockup arrives shredded and resolves: a scripted envelope over the
      // first half, then whatever random events land after it.
      const scripted = 0.85 * Math.max(0, 1 - u / 0.5);
      const g = scripted > 0.05 ? { amp: scripted } : glitchAt(t);
      glitchType(g, t, ({ dx = 0, dy = 0, skew = 0, alpha = 1 }) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.transform(1, 0, skew, 1, dx, dy);
        wordmark(969, 719, 141.7);
        ctx.restore();
      });
    },
  },
  { // 17 — the copy starts building around it
    id: 17, start: 22.8, end: 24.0,
    fx: () => ({ boost: 0.8, sharp: true }),
    async draw(u) {
      wordmark(969, 719, 141.7);
      typeOut(COPY.line,   179.46, 209.65, u / 0.45);
      typeOut(COPY.cities, 148.49,  79.16, (u - 0.20) / 0.45);
      typeOut(COPY.deploy, 122.41,  86.14, (u - 0.34) / 0.45);
      if (u > 0.30) dot(143.0 * PT, 81.3 * PT);
    },
  },
  { // 18 — and completes
    id: 18, start: 24.0, end: 25.4,
    // Exits on a static burst: this is the cut from the lockup to the big S.
    fx: (u) => {
      const b = burst(u, 1.0, 0.12);
      return { boost: 0.8, sharp: b < 0.05, comb: 0.084 + 0.6 * b,
               dragY: 85 * b, dragX: 50 * b };
    },
    async draw(u) {
      wordmark(969, 719, 141.7);
      label(COPY.line,   179.46, 209.65);
      label(COPY.cities, 148.49,  79.16);
      label(COPY.deploy, 122.41,  86.14);
      typeOut(COPY.cities, 187.43, 244.84, u / 0.4);
      typeOut(COPY.deploy, 221.20, 251.97, (u - 0.18) / 0.4);
      typeOut(COPY.line,   122.41,  42.13, (u - 0.34) / 0.4);
      dot(143.0 * PT, 81.3 * PT);
      if (u > 0.3) dot(182.0 * PT, 247.0 * PT);
    },
  },
  { // 19 — the black beat
    id: 19, start: 25.4, end: 26.0,
    fx: () => ({ boost: 0, grain: 0.20 }),
    async draw() {},
  },
  { // 20 — the big S with its trademark, and the transport marks
    id: 20, start: 26.0, end: 28.6,
    // Same one-sided defocus as the cropped S, and the same size drift.
    fx: (u) => ({
      boost: 1.6,
      blurAmp: 74 * Math.max(0, Math.sin((u - 0.14) / 0.46 * Math.PI)),
    }),
    async draw(u, t) {
      const k = 1.12 + 0.12 * Math.pow(1 - u, 2);
      glitchType(glitchAt(t), t, ({ dx = 0, dy = 0, skew = 0, alpha = 1 }) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.transform(1, 0, skew, 1, dx, dy);
        ctx.translate(959, 719);
        ctx.scale(k, k);
        ctx.translate(-959, -719);
        glyphAtCap('S', 1501, 959, 719 - 1073 / 2);
        ctx.restore();
      });
    },
    // The trademark and the transport marks live on the stable layer, so the
    // defocus and the corruption hit the letter alone and leave them clean.
    drawStable() {
      ctxB.save();
      ctxB.font = `700 ${1501 * 0.115}px HaasDisp, sans-serif`;
      ctxB.fillStyle = RED;
      ctxB.textAlign = 'left';
      ctxB.textBaseline = 'alphabetic';
      ctxB.fillText('™', 1310, 268);
      ctxB.restore();
      transportMarks(576, 1224, 26, ctxB);
    },
  },
  { // 21 — the lockup, small
    id: 21, start: 28.6, end: 32.0,
    // Holds, then leaves on a burst of static rather than a cut.
    fx: (u) => {
      const b = burst(u, 1.0, 0.09);
      return { boost: 0.6, sharp: b < 0.05, comb: 0.084 + 0.7 * b,
               dragY: 95 * b, dragX: 60 * b };
    },
    async draw(u) {
      if (u < 0.965) wordmark(964, 719, 38);
    },
  },
  { // 22 — out
    id: 22, start: 32.0, end: 33.0,
    fx: (u) => ({ boost: 0, grain: 0.234 * (1 - u), comb: 0.084 * (1 - u) }),
    async draw() {},
  },
];

const DURATION = BOARDS[BOARDS.length - 1].end;

function boardAt(t) {
  for (const b of BOARDS) if (t >= b.start && t < b.end) return b;
  return BOARDS[BOARDS.length - 1];
}


// Type corruption. In the HOT TAKES reference the word sits clean, then during
// an event it duplicates into two or three copies, each offset, some skewed,
// some ghosted back, and a horizontal band is sliced out and shifted sideways.
// Between events it is completely clean — so this does nothing unless an event
// is running.
function glitchType(g, t, paint, move = 1) {
  if (!g || g.amp < 0.12) { paint({}); return; }
  const s = Math.floor(t * STEP_FPS);
  const copies = 1 + Math.floor(hash11(s * 2.31) * 3);
  for (let i = copies - 1; i >= 0; i--) {
    paint({
      dx:    i === 0 ? 0 : (hash11(s * 3.11 + i * 7.7) - 0.5) * 300 * g.amp * move,
      dy:    i === 0 ? 0 : (hash11(s * 5.33 + i * 3.3) - 0.5) * 240 * g.amp * move,
      skew:  (hash11(s * 4.71 + i * 2.1) - 0.5) * 0.40 * g.amp * move,
      alpha: i === 0 ? 1 : 0.28 + 0.45 * hash11(s * 9.13 + i * 1.9),
    });
  }
  if (hash11(s * 6.73) < 0.55) {                       // sliced band
    const y0 = hash11(s * 8.31) * H * 0.75;
    const h  = 60 + hash11(s * 2.91) * 260;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y0, W, h); ctx.clip();
    paint({ dx: (hash11(s * 1.77) - 0.5) * 420 * g.amp * move });
    ctx.restore();
  }
}

// Paint a huge glyph through the corruption, by its cap box.
function corruptGlyph(g, t, ch, fontPx, cx, capTopPx, color = RED, move = 1) {
  glitchType(g, t, ({ dx = 0, dy = 0, skew = 0, alpha = 1 }) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.transform(1, 0, skew, 1, dx, dy);
    glyphAtCap(ch, fontPx, cx, capTopPx, color);
    ctx.restore();
  }, move);
}

// ---------------------------------------------------------------- glitch events
//
// The references are not continuously broken. TENDU and HOT TAKES both sit
// clean for long stretches and then corrupt for a few frames. So the heavy
// effects are discrete events on an irregular ~2-3s cadence, and only grain,
// fine lines and a trace of warp run continuously underneath.

const EVENTS = (() => {
  const out = [];
  let t = 0.55, i = 0;
  while (t < 40) {
    const dur = 0.10 + hash11(i * 3.17) * 0.28;         // 2-9 frames at 24fps
    out.push({ t0: t, t1: t + dur, kind: Math.floor(hash11(i * 11.71) * 4), seed: i });
    t += dur + 1.5 + hash11(i * 7.31) * 1.7;            // 1.5-3.2s of calm
    i++;
  }
  return out;
})();

// Envelope: snap in, decay out — glitches do not ease.
function glitchAt(t) {
  for (const e of EVENTS) {
    if (t >= e.t0 && t < e.t1) {
      const u = (t - e.t0) / (e.t1 - e.t0);
      return { ...e, u, amp: Math.pow(1 - u, 0.6) };
    }
  }
  return null;
}

// ---------------------------------------------------------------- effects

const VERT = `#version 300 es
void main(){
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uSrc, uSrcB;
uniform vec2  uRes;
uniform float uFrame, uStep;
uniform float uDragX, uDragY, uComb;
uniform float uBlurBase, uBlurAmp, uFocusDir;
uniform float uLines, uGrain;
out vec4 fragColor;

float hash11(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }
float hash21(vec2 p){ vec3 q=fract(vec3(p.xyx)*0.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
vec3  tex(vec2 uv){ return texture(uSrc, clamp(uv, 0.0, 1.0)).rgb; }

// Film grain clumps; it is not per-pixel white noise. Measured neighbour
// correlation is -0.174 in the TENDU reference against -0.377 for the naive
// version, so the noise is generated on a ~1.9px cell and smoothly
// interpolated, which softens it and drops the contrast.
// Grain scintillates in place: the lattice is fixed and only the value in each
// cell is reseeded per frame. An earlier version offset the lattice itself by
// (t*37.7, t*17.3), which slid the whole pattern across the screen — that is
// what read as the grain shifting position rather than appearing and
// disappearing. Applied last in the chain, after warp, drag and comb.
float grainCell(vec2 i, float t){
  vec3 q = fract(vec3(i.x, i.y, t) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yxz + 33.33);
  return fract((q.x + q.y) * q.z);
}

float grainNoise(vec2 p, float t){
  vec2 g = p / 1.10;
  vec2 i = floor(g), f = fract(g);
  f = f * f * (3.0 - 2.0 * f);
  float a = grainCell(i, t);
  float b = grainCell(i + vec2(1.0, 0.0), t);
  float c = grainCell(i + vec2(0.0, 1.0), t);
  float d = grainCell(i + vec2(1.0, 1.0), t);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) - 0.5;
}
float luma(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }

// A smooth focal gradient across the frame, in an arbitrary direction: one side
// sharp, the other soft, as in the blur references where SEVE is defocused and
// RE is not, or the S is sharp left and soft right.
float focusField(vec2 uv){
  vec2 d = vec2(cos(uFocusDir), sin(uFocusDir));
  return smoothstep(-0.45, 0.45, dot(uv - 0.5, d));
}

// Drag and defocus in one pass. The drag is 2D: the whole-screen reference
// pulls type into vertical streaks as often as horizontal ones.
vec3 softSample(vec2 uv, vec2 drag, float blurPx){
  float rx = blurPx + abs(drag.x) * 0.5;
  float ry = blurPx + abs(drag.y) * 0.5;
  if(rx < 0.6 && ry < 0.6) return tex(uv);
  vec2 centre = uv + drag * 0.5 / uRes;
  vec3 acc = vec3(0.0);
  const int N = 14;
  for(int i = 0; i < N; i++){
    float fi  = float(i);
    float ang = fi * 2.39996323;
    float rad = sqrt((fi + 0.5) / float(N));
    acc += tex(centre + vec2(cos(ang) * rad * rx, sin(ang) * rad * ry) / uRes);
  }
  return acc / float(N);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y;
  vec2 uvStable = uv;
  float y = (1.0 - uv.y) * uRes.y;
  float tSec = uFrame / 24.0;

  float blurPx = uBlurBase + uBlurAmp * focusField(uv);
  // Smooth, not banded — a per-band random sign produced hard horizontal bars.
  float dirSign = sin(y * 0.0021 + uStep * 0.55);
  vec3 c = softSample(uv, vec2(uDragX * dirSign, uDragY), blurPx);

  // The stable layer never warps, drags or slices — the dot holds its place.
  vec4 b = texture(uSrcB, clamp(uvStable, 0.0, 1.0));
  c = mix(c, b.rgb, b.a);

  // Fine vertical comb. Measured on TENDU: period 3.79px on a 1422px frame
  // (5.12px here) at 8.4% of local level, and it is unambiguously vertical --
  // column variation 63 against row variation 8.6.
  if(uComb > 0.0)
    c *= 1.0 - uComb * (0.5 + 0.5 * sin(gl_FragCoord.x * 1.2272));

  // Fine horizontal line dither: 1px lines on a 3px pitch. No thick bars.
  if(uLines > 0.0)
    c *= 1.0 - uLines * step(1.5, mod(gl_FragCoord.y, 3.0));

  // Grain peaks in the mid-tones and eases off at both ends, as film does.
  // Weighting it up in the shadows (as an earlier version did) pushed the noise
  // below the ground and clipped ~9% of it, which is what turned grain into
  // speckle on the dark areas.
  if(uGrain > 0.0){
    float l = luma(c);
    c += grainNoise(gl_FragCoord.xy, uFrame) * uGrain * (0.55 + 1.80 * l * (1.0 - l));
  }

  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

function compile(type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);

const U = Object.fromEntries(
  ['uSrc','uSrcB','uRes','uFrame','uStep','uDragX','uDragY','uComb',
   'uBlurBase','uBlurAmp','uFocusDir','uLines','uGrain']
    .map((n) => [n, gl.getUniformLocation(prog, n)]));

function makeTexture(unit) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
  for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR);
  return t;
}
const texA = makeTexture(0), texB = makeTexture(1);
gl.uniform1i(U.uSrc, 0);
gl.uniform1i(U.uSrcB, 1);
gl.viewport(0, 0, W, H);

// ---------------------------------------------------------------- driver

const FX = Number(new URLSearchParams(location.search).get('fx') || 1);
// Grain is off by default so the film can be graded and textured downstream.
// Nothing about it has been deleted: render with ?grain=1 to bring it back at
// the tuned settings (1.10px cell, amplitude 0.234, scintillating in place).
const GRAIN_SCALE = Number(new URLSearchParams(location.search).get('grain') ?? 0);

async function renderFrame(n) {
  const t = n / FPS;
  const b = boardAt(t);
  const u = (t - b.start) / (b.end - b.start);
  const base = b.fx(u, t) || {};
  const g = glitchAt(t);

  // Continuous floor: grain, lines and a trace of warp. Everything else only
  // exists inside a glitch event.
  const p = {
    dragX: 0, dragY: 0, comb: 0.084,
    blurBase: 0, blurAmp: 0, focusDir: hash11(Math.floor(t / 2.7) * 5.3) * 6.283,
    lines: 0.035, grain: 0.234,
    ...base,
  };

  if (g) {
    const a = g.amp * FX * (base.boost ?? 1);
    if (g.kind === 0) { p.dragY = 95 * a; p.comb += 0.16 * a; }            // vertical streak
    else if (g.kind === 1) { p.dragX = 120 * a; p.comb += 0.06 * a; }      // horizontal drag
    else if (g.kind === 2) { p.comb += 0.26 * a; p.dragY = 45 * a; }        // hard vertical combing
    else { p.dragX = 70 * a; p.dragY = 55 * a; p.comb += 0.14 * a; }        // both axes
    p.grain += 0.025 * a;
  }

  p.grain = (p.grain || 0) * GRAIN_SCALE;

  // A slow, always-present focal gradient, deepening during events. Boards of
  // small type opt out with `sharp` — copy that has to be read should not sit
  // under a defocus.
  p.blurAmp = (p.blurAmp || 0) + 6 + (g ? 26 * g.amp * FX : 0);
  if (base.sharp) { p.blurBase = 0; p.blurAmp = 0; }

  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, W, H);
  ctxB.clearRect(0, 0, W, H);
  await b.draw(u, t, t - b.start);
  if (b.drawStable) b.drawStable(u, t, t - b.start);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texA);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, texB);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcB);

  gl.uniform2f(U.uRes, W, H);
  gl.uniform1f(U.uFrame, n);
  gl.uniform1f(U.uStep, Math.floor(t * STEP_FPS));
  for (const [k, loc] of [['dragX',U.uDragX],['dragY',U.uDragY],
                          ['comb',U.uComb],['blurBase',U.uBlurBase],
                          ['blurAmp',U.uBlurAmp],['focusDir',U.uFocusDir],
                          ['lines',U.uLines],['grain',U.uGrain]]) {
    gl.uniform1f(loc, p[k] || 0);
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.finish();
}

await document.fonts.load('500 100px HaasDisp');
await document.fonts.load('700 100px HaasDisp');
await document.fonts.ready;

window.__render = renderFrame;
window.__meta   = { W, H, FPS, duration: DURATION, frames: Math.round(DURATION * FPS) };
window.__ready  = true;
