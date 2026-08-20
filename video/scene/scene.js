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
// Measured off the storyboard .ai: 4.02pt on a 400.2pt board = 19.28px at the
// 1920 master. The dot is the same size wherever it appears.
const DOT_D = 19.3;

const COPY = {
  line:   'Come to us when nice stops working.',
  cities: 'London   /   New York   /   Detroit',
  deploy: 'Deployed — Globally',
};

const src = document.getElementById('src');
const ctx = src.getContext('2d', { willReadFrequently: false });
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

function dot(x, y, color = RED) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, DOT_D / 2, 0, Math.PI * 2);
  ctx.fill();
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

// The three blocks of copy, placed exactly where the .ai puts them. Boards
// 10-13 share this field; `full` adds the pair the denser boards carry.
function typeField(full) {
  label(COPY.line,   258.83, 208.96);
  label(COPY.cities, 270.27,  78.47);
  label(COPY.deploy, 244.20,  85.45);
  label(COPY.cities, 239.49, 244.14);
  label(COPY.deploy, 273.25, 251.28);
  label(COPY.cities,   7.78, 180.08, { dir: -Math.PI / 2 });
  label(COPY.deploy,  14.76, 237.44, { dir: -Math.PI / 2 });
  label(COPY.line,     8.86,  27.05, { dir: -Math.PI / 2 });
  if (full) label(COPY.line, 244.19, 41.43);
  dot(264.5 * PT, 80.6 * PT);
  dot(234.0 * PT, 246.3 * PT);
}

// Record / pause / fast-forward, as they sit under the S on board 20.
function transportMarks(x, y, h) {
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

// ---------------------------------------------------------------- timeline
//
// Boards are the storyboard frames, read row-major. Times in seconds at 24fps.
// `fx` returns the effect-stack parameters for that board; `draw` paints the
// 2D composite that the shader then chews on.

const stepped = (t) => Math.floor(t * STEP_FPS) / STEP_FPS;

// Defocus pulse: the image goes soft and snaps back. Grain is applied after the
// blur, so every pulse makes the grain read harder against the mush.
function blurPulse(t, period, width, amp, phase = 0) {
  let ph = ((t + phase) % period) / period;
  return ph < width ? amp * Math.sin(Math.PI * ph / width) : 0;
}

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
    fx: (u, t) => ({ grain: 0.17, static: 0.11, comb: 0.06, warp: 0.030,
                     tear: 0, drag: 0, flash: 0,
                     blur: blurPulse(t, 1.30, 0.42, 5.0) }),
    async draw(u, t) {
      if (dotOn(t)) dot(W / 2, H / 2);
    },
  },
  { // 2 — distortion, then the eye. Black and white, the dot still on it.
    id: 2, start: 3.0, end: 5.0,
    fx: (u, t) => {
      const enter = Math.max(0, 1 - u / 0.28);
      return {
        grain:  0.19,
        static: 0.13 + 0.62 * enter,
        comb:   0.07 + 0.06 * enter,
        warp:   0.052 + 0.055 * enter + blurPulse(t, 1.7, 0.3, 0.030),
        drag:   26 + 96 * enter + blurPulse(t, 0.83, 0.18, 60),
        tear:   0.55 * enter,
        flash:  u < 0.22 ? 0.5 : 0,
        blur:   blurPulse(t, 0.91, 0.34, 9.0),
      };
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
    fx: (u, t) => ({ grain: 0.20, static: 0.26, comb: 0.09, blur: 0,
                     warp: 0.070, drag: 30 + blurPulse(t, 0.31, 0.3, 90),
                     tear:  u < 0.22 ? 0.6 : (u > 0.78 ? 0.6 : 0.0),
                     flash: u < 0.15 ? 0.35 : 0 }),
    async draw(u, t, tb) {
      const img = await loadPlate('eye', Math.round((2.0 + tb) * FPS) + 1);
      drawPlate(img, 1.02, 0, 0, 0.86);
      tintRed();
      verticalWordmark(W / 2, H / 2, H * 0.62);
    },
  },
  { // 4 — red eye, the dot now white
    id: 4, start: 5.4, end: 6.6,
    fx: (u, t) => ({ grain: 0.18, static: 0.14, comb: 0.07,
                     warp: 0.050 + blurPulse(t, 1.5, 0.34, 0.045),
                     drag: 22 + blurPulse(t, 0.66, 0.15, 72),
                     tear: u > 0.8 ? 0.45 : 0,
                     flash: u > 0.85 ? 0.4 : 0,
                     blur: blurPulse(t, 1.05, 0.38, 11.0) }),
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
    fx: (u, t) => ({ grain: 0.19, static: 0.10 + 0.22 * u, comb: 0.08,
                     warp: 0.055 + 0.055 * u * u + blurPulse(t, 1.1, 0.3, 0.040),
                     drag: 30 + 55 * u + blurPulse(t, 0.54, 0.16, 110),
                     tear: u < 0.12 ? 0.5 : 0.10 * u,
                     flash: u < 0.1 ? 0.45 : 0.10 * u,
                     blur: blurPulse(t, 0.77, 0.30, 13.0) }),
    async draw(u, t) {
      const s = stepped(t);
      const drift = (hash11(s * 4.1) - 0.5) * 40;
      // a detail of the letter, not the letter: the frame crops into the bowl
      hugeGlyph('S', 4200, W * 0.46 + drift, H * 0.92, RED);
    },
  },
  { // 6 — back to black, the marker alone
    id: 6, start: 8.2, end: 8.9,
    fx: (u, t) => ({ grain: 0.17, static: 0.13, tear: 0, chroma: 0, flash: 0,
                     blur: blurPulse(t, 1.1, 0.4, 4.0) }),
    async draw() { label('S.', 177.40, 139.34); },
  },
  { // 7 — the cities arrive next to it
    id: 7, start: 8.9, end: 10.1,
    fx: (u, t) => ({ grain: 0.17, static: 0.14, chroma: 0,
                     tear: blurPulse(t, 0.7, 0.14, 0.30), flash: u < 0.1 ? 0.3 : 0,
                     blur: blurPulse(t, 1.2, 0.36, 5.0) }),
    async draw() { label('S.', 177.40, 139.34); cityStack(197.27, 139.34); },
  },
  { // 8 — the radial composition: Deployed / Globally on 45deg steps
    id: 8, start: 10.1, end: 11.6,
    fx: (u, t) => ({ grain: 0.18, static: 0.16, chroma: 0,
                     tear: blurPulse(t, 0.6, 0.13, 0.35), flash: 0.08,
                     blur: blurPulse(t, 0.95, 0.32, 6.0) }),
    async draw(u, t) {
      label('S.', 177.40, 139.34); cityStack(197.27, 139.34);
      const step = Math.floor(t * STEP_FPS);
      for (let i = 0; i < 8; i++) {
        if (hash11(i * 5.7 + step * 1.9) < 0.12) continue;   // some flick out
        const a = i * Math.PI / 4;
        const r = 58 + 6 * Math.sin(step * 0.7 + i);
        label(i % 2 ? 'Globally' : 'Deployed',
              200 + Math.cos(a) * r, 150 + Math.sin(a) * r, { dir: a });
      }
    },
  },
  { // 9 — SEV: the vertical lockup blown up and rotated 180deg, cropped
    id: 9, start: 11.6, end: 12.4,
    fx: (u, t) => ({ grain: 0.19, static: 0.12, chroma: 0,
                     tear: 0.25 + 0.5 * blurPulse(t, 0.45, 0.3, 1.0), flash: 0.18,
                     blur: blurPulse(t, 0.6, 0.3, 8.0) }),
    async draw(u, t) {
      const drift = (hash11(Math.floor(t * STEP_FPS) * 3.3) - 0.5) * 30;
      hugeVertical(711 + drift, -300, 845);          // S / E / V
    },
  },
  { // 10 — ER, with the copy stacked around it
    id: 10, start: 12.4, end: 13.3,
    fx: (u, t) => ({ grain: 0.19, static: 0.14, chroma: 0,
                     tear: 0.20 + 0.5 * blurPulse(t, 0.4, 0.28, 1.0), flash: 0.18,
                     blur: blurPulse(t, 0.66, 0.3, 8.0) }),
    async draw(u, t) {
      const drift = (hash11(Math.floor(t * STEP_FPS) * 6.1) - 0.5) * 26;
      hugeVertical(870 + drift, -2700, 845);         // ...scrolled on to E / R
      typeField(true);
    },
  },
  { // 11 — the type field alone
    id: 11, start: 13.3, end: 14.4,
    fx: (u, t) => ({ grain: 0.17, static: 0.15, chroma: 0,
                     tear: blurPulse(t, 0.55, 0.14, 0.32), flash: 0.10,
                     blur: blurPulse(t, 1.15, 0.35, 5.0) }),
    async draw() { typeField(false); },
  },
  { // 12 — the trees, black and white
    id: 12, start: 14.4, end: 16.2,
    fx: (u, t) => ({ grain: 0.19, static: u < 0.15 ? 0.5 : 0.13, chroma: 0,
                     tear: u < 0.15 ? 0.7 : blurPulse(t, 0.8, 0.14, 0.28),
                     flash: u < 0.12 ? 0.4 : 0.05,
                     blur: blurPulse(t, 1.0, 0.34, 9.0) }),
    async draw(u, t, tb) {
      drawPlate(await loadPlate('trees', treeFrame(tb, 0.4)), 1.03, 0, 0, 0.9);
      typeField(false);
    },
  },
  { // 13 — the same trees, red
    id: 13, start: 16.2, end: 17.8,
    fx: (u, t) => ({ grain: 0.19, static: 0.14, chroma: 0,
                     tear: blurPulse(t, 0.72, 0.14, 0.30), flash: 0.06,
                     blur: blurPulse(t, 1.05, 0.34, 9.0) }),
    async draw(u, t, tb) {
      drawPlate(await loadPlate('trees', treeFrame(tb, 1.39)), 1.03, 0, 0, 0.9);
      tintRed();
      typeField(false);
    },
  },
  { // 14 — five white lockups down the 9:16 column
    id: 14, start: 17.8, end: 19.4,
    fx: (u, t) => ({ grain: 0.19, static: 0.15, chroma: 0,
                     tear: blurPulse(t, 0.62, 0.16, 0.34), flash: 0.10,
                     blur: blurPulse(t, 0.88, 0.3, 8.0) }),
    async draw(u, t, tb) {
      drawPlate(await loadPlate('trees', treeFrame(tb, 2.27)), 1.03, 0, 0, 0.9);
      tintRed();
      const step = Math.floor(t * STEP_FPS);
      for (let i = 0; i < 5; i++) {
        if (hash11(i * 9.1 + step * 2.3) < 0.10) continue;
        wordmark(SAFE_V.x + SAFE_V.w / 2, 46 + i * 311, 110, '#fff');
      }
      dot(SAFE_V.x + 8, 118, '#fff');
      transportMarks(SAFE_V.x + SAFE_V.w - 96, 108, 22);
    },
  },
  { // 15 — back to black and white, the stack alternating red and white
    id: 15, start: 19.4, end: 20.8,
    fx: (u, t) => ({ grain: 0.19, static: 0.16, chroma: 0,
                     tear: blurPulse(t, 0.58, 0.16, 0.36), flash: 0.12,
                     blur: blurPulse(t, 0.92, 0.3, 8.0) }),
    async draw(u, t, tb) {
      drawPlate(await loadPlate('trees', treeFrame(tb, 3.15)), 1.03, 0, 0, 0.9);
      const step = Math.floor(t * STEP_FPS);
      for (let i = 0; i < 5; i++) {
        if (hash11(i * 4.3 + step * 3.1) < 0.10) continue;
        wordmark(SAFE_V.x + SAFE_V.w / 2, 46 + i * 311, 110, i % 2 ? RED : '#fff');
      }
      label(COPY.cities, 161.33, 135.97);
      label(COPY.deploy, 174.04, 142.95);
      label(COPY.line,   153.61, 156.91);
    },
  },
  { // 16 — the reveal. Cosmos treatment: the lockup multiplies, offsets and
    //      shreds on the 12fps step, over black.
    id: 16, start: 20.8, end: 22.8,
    fx: (u, t) => ({ grain: 0.18, static: 0.10 + 0.10 * (1 - u), chroma: 0,
                     tear: u < 0.55 ? 0.45 * (1 - u / 0.55) : 0.04,
                     flash: u < 0.4 ? 0.35 : 0.04,
                     blur: blurPulse(t, 1.25, 0.3, 6.0) }),
    async draw(u, t) {
      const step = Math.floor(t * STEP_FPS);
      const copies = u < 0.5 ? 1 + Math.floor(hash11(step * 7.7) * 3) : 1;
      for (let i = 0; i < copies; i++) {
        const off = i === 0 ? 0 : (hash11(step * 3.9 + i * 2.1) - 0.5) * 420;
        const sx  = i === 0 ? 0 : (hash11(step * 5.1 + i * 1.3) - 0.5) * 160;
        wordmark(969 + sx, 719 + off, 141.7);
      }
    },
  },
  { // 17 — the copy starts building around it
    id: 17, start: 22.8, end: 24.0,
    fx: (u, t) => ({ grain: 0.17, static: 0.11, chroma: 0,
                     tear: blurPulse(t, 0.85, 0.12, 0.22), flash: 0.05,
                     blur: blurPulse(t, 1.3, 0.32, 5.0) }),
    async draw() {
      wordmark(969, 719, 141.7);
      label(COPY.line,   179.46, 209.65);
      label(COPY.cities, 148.49,  79.16);
      label(COPY.deploy, 122.41,  86.14);
      dot(143.0 * PT, 81.3 * PT);
    },
  },
  { // 18 — and completes
    id: 18, start: 24.0, end: 25.4,
    fx: (u, t) => ({ grain: 0.17, static: 0.11, chroma: 0,
                     tear: blurPulse(t, 0.8, 0.12, 0.24), flash: 0.05,
                     blur: blurPulse(t, 1.35, 0.32, 5.0) }),
    async draw() {
      wordmark(969, 719, 141.7);
      label(COPY.line,   179.46, 209.65);
      label(COPY.cities, 148.49,  79.16);
      label(COPY.deploy, 122.41,  86.14);
      label(COPY.cities, 187.43, 244.84);
      label(COPY.deploy, 221.20, 251.97);
      label(COPY.line,   122.41,  42.13);
      dot(143.0 * PT, 81.3 * PT);
      dot(182.0 * PT, 247.0 * PT);
    },
  },
  { // 19 — the black beat
    id: 19, start: 25.4, end: 26.0,
    fx: () => ({ grain: 0.14, static: 0.07, tear: 0, chroma: 0, flash: 0, blur: 0 }),
    async draw() {},
  },
  { // 20 — the big S with its trademark, and the transport marks
    id: 20, start: 26.0, end: 28.6,
    fx: (u, t) => ({ grain: 0.19, static: 0.10 + 0.20 * u, chroma: 0,
                     tear: u < 0.10 ? 0.7 : 0.06 + 0.5 * u * u
                           + blurPulse(t, 0.5, 0.15, 0.35),
                     flash: u < 0.1 ? 0.4 : 0.06 + 0.14 * u,
                     blur: blurPulse(t, 0.82, 0.3, 11.0) }),
    async draw(u, t) {
      const drift = (hash11(Math.floor(t * STEP_FPS) * 2.7) - 0.5) * 22;
      glyphAtCap('S', 1501, 959 + drift, 719 - 1073 / 2);
      setType(1501 * 0.115, 700);
      ctx.fillStyle = RED; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('™', 1310 + drift, 268);
      transportMarks(576 + drift, 1224, 26);
    },
  },
  { // 21 — the lockup, small
    id: 21, start: 28.6, end: 30.0,
    fx: (u, t) => ({ grain: 0.16, static: 0.09, chroma: 0,
                     tear: u < 0.08 ? 0.5 : 0, flash: u < 0.08 ? 0.3 : 0,
                     blur: blurPulse(t, 1.4, 0.3, 4.0) }),
    async draw() { wordmark(964, 719, 38); },
  },
  { // 22 — out
    id: 22, start: 30.0, end: 31.0,
    fx: (u) => ({ grain: 0.13 * (1 - u), static: 0.05 * (1 - u),
                  tear: 0, chroma: 0, flash: 0, blur: 0 }),
    async draw() {},
  },
];

const DURATION = BOARDS[BOARDS.length - 1].end;

function boardAt(t) {
  for (const b of BOARDS) if (t >= b.start && t < b.end) return b;
  return BOARDS[BOARDS.length - 1];
}

// ---------------------------------------------------------------- effects
//
// One fullscreen pass. Chroma leak is edge-local and additive, not a global
// channel translate — measured on the BEAMS reference, whose global per-channel
// offset is 0px while its fringing sits only on high-contrast edges. Modelling
// it additively also means it works on a pure-red source, where simply shifting
// the blue channel would do nothing at all (there is no blue to shift).

const VERT = `#version 300 es
void main(){
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2  uRes;
uniform float uFrame, uStep, uTear, uWarp, uDrag, uComb, uGrain, uStatic, uBlur;
out vec4 fragColor;

float hash11(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }
float hash21(vec2 p){ vec3 q=fract(vec3(p.xyx)*0.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
vec3  tex(vec2 uv){ return texture(uSrc, clamp(uv, 0.0, 1.0)).rgb; }
float luma(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }

// Serpentine tape warp. Traced off TENDU frame 0009: a stripe wanders +/-142px
// on a 1422px frame (rms 70px), and a single sine explains only 36% of that —
// it is several octaves summed. The measured periods, 617 / 308 / 206 / 103px
// on a 792px frame, scale to roughly frame-height / 3 / 6 here.
float warp(float y, float t){
  float w = sin(y * 6.2831 / 1440.0 + t * 0.70)
     + 0.45 * sin(y * 6.2831 /  480.0 + t * 1.30 + 1.7)
     + 0.22 * sin(y * 6.2831 /  240.0 + t * 2.10 + 3.1)
     + 0.10 * sin(y * 6.2831 /  120.0 + t * 3.30 + 5.2);
  return w / 1.77;
}

// Directional drag plus defocus in one pass. A trailing smear is approximated
// as a disc offset half its length and stretched along x, which costs one loop
// instead of two and is indistinguishable at these radii.
vec3 softSample(vec2 uv, float dragPx, float blurPx){
  float rx = blurPx + abs(dragPx) * 0.5;
  float ry = blurPx;
  if(rx < 0.6 && ry < 0.6) return tex(uv);
  vec2 centre = uv + vec2(dragPx * 0.5 / uRes.x, 0.0);
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
  float y = (1.0 - uv.y) * uRes.y;
  float tSec = uFrame / 24.0;

  // 1. the warp — the dominant move, smooth and continuous
  uv.x += warp(y, tSec * 2.4) * uWarp;

  // 2. a much rarer hard tear: a few narrow bands only, not the whole frame
  if(uTear > 0.0){
    float band = floor(y / mix(18.0, 46.0, hash11(uStep * 3.7)));
    float r = hash11(band * 7.13 + uStep * 11.7);
    if(r > 1.0 - 0.18 * uTear)
      uv.x += (hash11(band * 3.1 + uStep * 5.3) - 0.5) * 0.30 * uTear;
  }

  // 3. drag and defocus, sampled together
  float dragDir = hash11(floor(y / 90.0) * 2.7 + uStep * 1.3) < 0.5 ? -1.0 : 1.0;
  vec3 c = softSample(uv, uDrag * dragDir, uBlur);

  // 4. fine vertical comb — measured at ~6% modulation depth
  if(uComb > 0.0)
    c *= 1.0 - uComb * 0.5 * (0.5 + 0.5 * sin(gl_FragCoord.x * 2.0944));

  // 5. analog snow and dropout bands, regenerated every frame at 24
  if(uStatic > 0.0){
    float row  = floor(gl_FragCoord.y);
    float segW = mix(2.0, 10.0, hash21(vec2(row, floor(uFrame) * 0.37)));
    float seg  = floor(gl_FragCoord.x / segW);
    c += (hash21(vec2(seg, row * 1.7 + uFrame * 13.0)) - 0.45) * uStatic * 0.60;
    if(hash21(vec2(row, floor(uFrame))) < uStatic * 0.10){
      float sx = hash21(vec2(gl_FragCoord.x * 0.35, row + uFrame * 3.0));
      c += vec3(step(0.55, sx)) * uStatic * 1.10;
    }
  }

  if(uGrain > 0.0){
    float n1 = hash21(gl_FragCoord.xy + vec2(uFrame*37.7, uFrame*17.3)) - 0.5;
    float n2 = hash21(gl_FragCoord.yx*1.7 + vec2(uFrame*11.1, uFrame*29.3)) - 0.5;
    c += (n1 + n2) * uGrain * (1.0 - 0.6 * luma(c));
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
  ['uSrc','uRes','uFrame','uStep','uTear','uWarp','uDrag','uComb','uGrain','uStatic','uBlur']
    .map((n) => [n, gl.getUniformLocation(prog, n)]));

const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR);
gl.uniform1i(U.uSrc, 0);
gl.viewport(0, 0, W, H);

// ---------------------------------------------------------------- driver

// ?fx=1.8 scales the whole distortion stack in one go, so intensity variants
// can be rendered without touching per-board numbers.
const FX = Number(new URLSearchParams(location.search).get('fx') || 1);

async function renderFrame(n) {
  const t = n / FPS;
  const b = boardAt(t);
  const u = (t - b.start) / (b.end - b.start);
  const p = b.fx(u, t);
  for (const k of ['warp', 'drag', 'tear', 'comb', 'static']) {
    if (p[k]) p[k] *= FX;
  }

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const flash = blackFlash(t, p.flash || 0);
  if (!flash) await b.draw(u, t, t - b.start);

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.uniform2f(U.uRes, W, H);
  gl.uniform1f(U.uFrame, n);
  gl.uniform1f(U.uStep, Math.floor(t * STEP_FPS));
  gl.uniform1f(U.uTear,   flash ? 0 : (p.tear   || 0));
  gl.uniform1f(U.uWarp,   flash ? 0 : (p.warp   || 0));
  gl.uniform1f(U.uDrag,   flash ? 0 : (p.drag   || 0));
  gl.uniform1f(U.uComb,   flash ? 0 : (p.comb   || 0));
  gl.uniform1f(U.uStatic, flash ? 0 : (p.static || 0));
  gl.uniform1f(U.uBlur,   flash ? 0 : (p.blur || 0));
  gl.uniform1f(U.uGrain,  p.grain || 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.finish();
}

await document.fonts.load('500 100px HaasDisp');
await document.fonts.load('700 100px HaasDisp');
await document.fonts.ready;

window.__render   = renderFrame;
window.__meta     = { W, H, FPS, duration: DURATION, frames: Math.round(DURATION * FPS) };
window.__ready    = true;
