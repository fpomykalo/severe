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
const DOT_D = 7;                      // the dot is the same size wherever it appears

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

// 1–2 frame black flashes at the TENDU rhythm (~one every 0.29s when active).
function blackFlash(t, rate) {
  if (rate <= 0) return false;
  const slot = Math.floor(t / 0.29);
  return hash11(slot * 17.3) < rate;
}

const BOARDS = [
  { // 1 — black, the dot starts blinking
    id: 1, start: 0.0, end: 3.0,
    fx: (u) => ({ grain: 0.055, static: 0.02, tear: 0, chroma: 0, flash: 0 }),
    async draw(u, t) {
      if (dotOn(t)) dot(W / 2, H / 2);
    },
  },
  { // 2 — distortion, then the eye. Black and white, the dot still on it.
    id: 2, start: 3.0, end: 5.0,
    fx: (u) => ({
      grain: 0.075,
      static: u < 0.28 ? 0.55 * (1 - u / 0.28) + 0.05 : 0.05,
      tear:   u < 0.28 ? 0.85 * (1 - u / 0.28) : 0,
      chroma: u < 0.28 ? 3.5 : 1.2,
      flash:  u < 0.22 ? 0.5 : 0,
    }),
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
    fx: (u) => ({ grain: 0.08, static: 0.06, chroma: 5.0,
                  tear:  u < 0.22 ? 0.7 : (u > 0.78 ? 0.7 : 0.0),
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
    fx: (u) => ({ grain: 0.075, static: 0.04, tear: u > 0.8 ? 0.5 : 0.06, chroma: 1.8,
                  flash: u > 0.85 ? 0.4 : 0 }),
    async draw(u, t, tb) {
      const img = await loadPlate('eye', Math.round((4.0 + tb) * FPS) + 1);
      drawPlate(img, 1.02 + u * 0.06, 0, 0, 0.86);
      tintRed();
      dot(W / 2, H / 2, '#fff');
    },
  },
  { // 5 — into the S. The shape is big enough for the chroma leak to read.
    id: 5, start: 6.6, end: 8.2,
    fx: (u) => ({ grain: 0.07, static: 0.03,
                  tear: u < 0.12 ? 0.7 : 0.05 + 0.25 * Math.max(0, u - 0.7),
                  chroma: 9.0, flash: u < 0.1 ? 0.45 : 0 }),
    async draw(u, t) {
      const s = stepped(t);
      const drift = (hash11(s * 4.1) - 0.5) * 40;
      // a detail of the letter, not the letter: the frame crops into the bowl
      hugeGlyph('S', 4200, W * 0.46 + drift, H * 0.92, RED);
    },
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
uniform float uFrame, uStep, uTear, uChroma, uGrain, uStatic;
out vec4 fragColor;

float hash11(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }
float hash21(vec2 p){ vec3 q=fract(vec3(p.xyx)*0.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
vec3  tex(vec2 uv){ return texture(uSrc, clamp(uv, 0.0, 1.0)).rgb; }
float sig(vec2 uv){ vec3 c=tex(uv); return max(max(c.r,c.g),c.b); }
float luma(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }

// Block tearing. Measured on TENDU: median row shift 3.9% of width, p95 36.6%,
// peak 39.9% — heavy-tailed, so pow(r,6) rather than anything symmetric. Bands
// are 70-90px tall, the dominant vertical period in the displacement field.
vec2 tearUV(vec2 uv){
  if(uTear <= 0.0) return uv;
  float bandH = mix(70.0, 90.0, hash11(uStep*3.7));
  float band  = floor(uv.y*uRes.y / bandH);
  float r     = hash11(band*7.13 + uStep*11.7);
  float sgn   = hash11(band*3.1 + uStep*5.3) < 0.5 ? -1.0 : 1.0;
  float off   = sgn * pow(r, 6.0) * 0.40 * uTear;
  // plus the occasional full-frame split, also present in the reference
  if(hash11(uStep*2.9) < 0.25*uTear && uv.y > hash11(uStep*6.1))
    off += (hash11(uStep*8.7) - 0.5) * 0.5 * uTear;
  return vec2(uv.x + off, uv.y);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y;
  uv = tearUV(uv);

  vec3 c = tex(uv);

  if(uChroma > 0.0){
    vec2 px  = 1.0 / uRes;
    vec2 dir = normalize(uv - 0.5 + vec2(1e-5));   // lateral CA grows from centre
    vec2 d   = dir * uChroma * px;
    float s0 = sig(uv), sF = sig(uv + d), sB = sig(uv - d);
    float edgeWarm = max(0.0, sF - s0);            // red/orange side
    float edgeCool = max(0.0, sB - s0);            // blue/cyan side
    c.r += edgeWarm * 0.90;
    c.g += edgeWarm * 0.45 + edgeCool * 0.55;
    c.b += edgeCool * 0.90;
  }

  if(uStatic > 0.0){
    float row = floor(gl_FragCoord.y);
    if(hash21(vec2(row, uFrame)) < uStatic * 0.35){
      float sx = hash21(vec2(gl_FragCoord.x * 0.5, row + uFrame * 3.0));
      c += vec3(step(0.72, sx)) * uStatic * 0.9;
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
  ['uSrc','uRes','uFrame','uStep','uTear','uChroma','uGrain','uStatic']
    .map((n) => [n, gl.getUniformLocation(prog, n)]));

const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR);
gl.uniform1i(U.uSrc, 0);
gl.viewport(0, 0, W, H);

// ---------------------------------------------------------------- driver

async function renderFrame(n) {
  const t = n / FPS;
  const b = boardAt(t);
  const u = (t - b.start) / (b.end - b.start);
  const p = b.fx(u, t);

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
  gl.uniform1f(U.uChroma, flash ? 0 : (p.chroma || 0));
  gl.uniform1f(U.uStatic, flash ? 0 : (p.static || 0));
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
