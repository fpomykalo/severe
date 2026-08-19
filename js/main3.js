/* SEVERE v3 — orchestration.
   Intro: staggered random-character reveal (letters + cities/clock), then a
   wheel-triggered morph of the big lockup into the header wordmark (no page
   scroll, one-way) while the nav writes itself out the same way.
   Main: cursor movement cycles fullscreen images.
   Overlay: manifesto / personnel / inquire dropdowns, accordion bios. */

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const body = document.body;
const bgImg = $('#bg-img');
const lockup = $('#hero-lockup');
const heroWord = $('#hero-word');
const heroTm = $('#hero-tm');
const mq = matchMedia('(max-width: 700px)');

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&/*+=-';
const rndChar = (tick, i) => CHARS[Math.abs(tick * 13 + i * 7 + ((tick * i) | 0)) % CHARS.length];
const scrambleable = (ch) => /[A-Za-z0-9@.]/.test(ch);

/* ---------- generic staggered scramble-in for a text element ---------- */

function scrambleText(el, finalFn, { delay = 0, perChar = 25, dur = 400, flip = 45, seed = 0 } = {}) {
  let raf = 0;
  let done = false;
  const start = performance.now() + delay;
  el.textContent = '';
  function finish() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    el.textContent = finalFn();
  }
  function frame(now) {
    if (done) return;
    const t = now - start;
    const final = finalFn();
    const tick = Math.floor((now - start) / flip);
    let out = '';
    let running = false;
    for (let i = 0; i < final.length; i++) {
      const si = i * perChar;
      const ch = final[i];
      if (t < si) { running = true; break; }
      if (t >= si + dur) { out += ch; continue; }
      running = true;
      out += scrambleable(ch) ? rndChar(tick, i + seed) : ch;
    }
    el.textContent = out;
    if (running) raf = requestAnimationFrame(frame);
    else done = true;
  }
  raf = requestAnimationFrame(frame);
  return { finish };
}

/* ---------- hero slots: same effect, one slot per letter ---------- */

function scrambleSlots(spans, finals, { delay = 150, stagger = 90, dur = 650, flip = 45 } = {}) {
  let raf = 0;
  let done = false;
  const start = performance.now() + delay;
  spans.forEach((s) => { s.textContent = ''; });
  function finish() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    spans.forEach((s, i) => { s.textContent = finals[i]; });
  }
  function frame(now) {
    if (done) return;
    const t = now - start;
    const tick = Math.floor((now - start) / flip);
    let running = false;
    spans.forEach((s, i) => {
      const si = i * stagger;
      if (t < si) { s.textContent = ''; running = true; }
      else if (t >= si + dur) { s.textContent = finals[i]; }
      else { s.textContent = rndChar(tick, i + 11); running = true; }
    });
    if (running) raf = requestAnimationFrame(frame);
    else done = true;
  }
  raf = requestAnimationFrame(frame);
  return { finish };
}

/* ---------- live clocks: London / New York–Detroit, HH:MM.SS ---------- */

const fmtCache = {};
function timeIn(tz) {
  const f = fmtCache[tz] ||= new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const t = f.format(new Date());
  return t.slice(0, 5) + '.' + t.slice(6);
}
let clockLive = false;
function tickClock() {
  if (!clockLive) return;
  $('#clock-l').textContent = timeIn('Europe/London');
  $('#clock-r').textContent = timeIn('America/Detroit');
}
setInterval(tickClock, 250);

/* second clock column starts where it does in Figma: after "22:04.37" + 20 spaces
   (measured at 12px for desktop, 10px for mobile) */
document.fonts.ready.then(() => {
  const ctx = document.createElement('canvas').getContext('2d');
  const PRE = '22:04.37                    ';
  ctx.font = '500 12px HaasDisp';
  document.documentElement.style.setProperty('--clock2', ctx.measureText(PRE).width + 'px');
  ctx.font = '500 10px HaasDisp';
  document.documentElement.style.setProperty('--clock2-m', ctx.measureText(PRE).width + 'px');
});

/* the image pool stays background-only: no context menu, no drag-out */
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('dragstart', (e) => { if (e.target.closest('img, #bg')) e.preventDefault(); });

/* ---------- intro reveal: hero letters + cities + clock ---------- */

const heroSpans = $$('#hero-word span');
const HERO = ['S', 'E', 'V', 'E', 'R', 'E'];
heroSpans.forEach((s) => { s.textContent = ''; });
$('#cities').textContent = '';
$('#clock-l').textContent = '';
$('#clock-r').textContent = '';

let heroScr = null;
document.fonts.ready.then(() => {
  body.classList.add('boot');       // lockup transform is applied, scramblers own the text
  heroScr = scrambleSlots(heroSpans, HERO, { delay: 150, stagger: 90, dur: 650 });
  scrambleText($('#cities'), () => 'London   /   New York   /   Detroit', { delay: 250, perChar: 25, dur: 400 });
  scrambleText($('#clock-l'), () => timeIn('Europe/London'), { delay: 450, perChar: 30, dur: 350 });
  const rScr = scrambleText($('#clock-r'), () => timeIn('America/Detroit'), { delay: 650, perChar: 30, dur: 350 });
  setTimeout(() => { clockLive = true; }, 1700);
});

/* ---------- lockup geometry (design units: S ink at 0,0; cap box 1416x260) ---------- */

const LC = { x: 708, y: 130.3 };            // lockup local center
const TM0 = { l: 1389.037, t: 0.55, w: 26.964 };
const TM1 = { l: 1415.75, t: 0, w: 70.583 };
const S_END = 36 / 363;

/* mobile intro: Figma scale 0.51554 reduced 10% per user note; the ™ is hidden
   there, so the lockup centers on the word alone (word center is 17.63 design
   units left of the full-lockup center) */
const MOB_S = 0.51554 * 0.9;
const WORD_CENTER_DX = 17.63;
function introT() {
  if (mq.matches) {
    return { X: innerWidth / 2 + 0.42, Y: innerHeight / 2 - 2 - WORD_CENTER_DX * MOB_S, a: -90, s: MOB_S, ls: -3.63 };
  }
  const k = innerWidth / 1440;
  return { X: (11 + LC.x) * k, Y: (63 + LC.y) * k, a: 0, s: k, ls: -3.63 };
}
function mainT() {
  const base = mq.matches ? 16 : innerWidth / 4 + 8;
  const top = mq.matches ? 67 : 20;
  return { X: base + 0.595 + LC.x * S_END, Y: top + LC.y * S_END, a: 0, s: S_END, ls: 0 };
}
function applyT(t, tmMix) {
  lockup.style.transform =
    `translate(${t.X}px, ${t.Y}px) rotate(${t.a}deg) scale(${t.s}) translate(${-LC.x}px, ${-LC.y}px)`;
  heroWord.style.letterSpacing = t.ls + 'px';
  const m = tmMix ?? 0;
  heroTm.style.left = TM0.l + (TM1.l - TM0.l) * m + 'px';
  heroTm.style.top = TM0.t + (TM1.t - TM0.t) * m + 'px';
  heroTm.style.width = TM0.w + (TM1.w - TM0.w) * m + 'px';
}
applyT(introT(), 0);

addEventListener('resize', () => {
  if (body.dataset.state === 'intro') applyT(introT(), 0);
});

/* ---------- morph: intro -> main (one-way, no page scroll) ---------- */

const NAV_ITEMS = $$('.navitem');
const NAV_TEXT = NAV_ITEMS.map((el) => el.textContent);
NAV_ITEMS.forEach((el) => { el.textContent = ''; });

const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const MORPH_MS = 900;

function startMorph() {
  if (body.dataset.state !== 'intro') return;
  body.dataset.state = 'morph';
  if (heroScr) heroScr.finish();
  NAV_ITEMS.forEach((el, i) => {
    scrambleText(el, () => NAV_TEXT[i], { delay: 100, perChar: 35, dur: 350, seed: 29 * (i + 1) });
  });
  const t0 = performance.now();
  (function frame(now) {
    const p = Math.min(1, (now - t0) / MORPH_MS);
    const e = easeInOut(p);
    const A = introT();
    const B = mainT();
    applyT({
      X: A.X + (B.X - A.X) * e,
      Y: A.Y + (B.Y - A.Y) * e,
      a: A.a + (B.a - A.a) * e,
      s: A.s + (B.s - A.s) * e,
      ls: A.ls + (B.ls - A.ls) * e,
    }, e);
    if (p < 1) requestAnimationFrame(frame);
    else body.dataset.state = 'main';
  })(t0);
}

addEventListener('wheel', (e) => { if (e.deltaY > 4) startMorph(); }, { passive: true });
addEventListener('keydown', (e) => {
  if (['ArrowDown', 'PageDown', ' '].includes(e.key)) startMorph();
});
let touchY = null;
addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
addEventListener('touchmove', (e) => {
  if (touchY !== null && touchY - e.touches[0].clientY > 30) { touchY = null; startMorph(); }
}, { passive: true });

/* ---------- image pool: assets/v3/images, one shuffled deck ---------- */

const IMAGES = [];
for (let i = 1; i <= 17; i++) IMAGES.push(`assets/v3/images/f/f${String(i).padStart(2, '0')}.jpg`);
for (let i = 1; i <= 21; i++) IMAGES.push(`assets/v3/images/z/z${String(i).padStart(2, '0')}.jpg`);
for (let i = IMAGES.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [IMAGES[i], IMAGES[j]] = [IMAGES[j], IMAGES[i]];
}

/* Decoded ahead of use: swapping src every 140ms would otherwise force a
   synchronous decode of an 8MP JPEG on the main thread (visible stutter).
   Image objects are retained so their decoded frames stay in cache, and the
   next deck entries are re-decoded ahead of each swap. */
const loaded = [];
bgImg.decoding = 'async';
(function preload(i) {
  if (i >= IMAGES.length) return;
  const im = new Image();
  im.decoding = 'async';
  im.src = IMAGES[i];
  im.decode().then(() => { loaded.push(im); preload(i + 1); },
                   () => preload(i + 1));
})(0);

let bgIdx = -1;
let lastSwap = 0;
const SWAP_MS = 140;

addEventListener('pointermove', () => {
  if (body.dataset.state !== 'main' || body.classList.contains('overlay')) return;
  const now = performance.now();
  if (now - lastSwap < SWAP_MS || !loaded.length) return;
  lastSwap = now;
  bgIdx = (bgIdx + 1) % loaded.length;
  bgImg.src = loaded[bgIdx].src;
  bgImg.style.display = 'block';
  for (let a = 1; a <= 2; a++) {
    const nxt = loaded[(bgIdx + a) % loaded.length];
    if (nxt) nxt.decode().catch(() => {});
  }
});

/* ---------- overlay ---------- */

function collapseRows() {
  $$('.p-row.open').forEach((r) => r.classList.remove('open'));
}
function openTab(tab) {
  if (tab !== 'personnel') collapseRows();
  body.classList.add('overlay');
  body.dataset.tab = tab;
}
function closeOverlay() {
  body.classList.remove('overlay');
  body.removeAttribute('data-tab');
  collapseRows();
}

/* nav items + column labels toggle: same tab again closes */
$$('.navitem, .col-label').forEach((el) => {
  el.addEventListener('click', (e) => {
    if (body.dataset.state !== 'main') return;
    e.stopPropagation();
    if (body.classList.contains('overlay') && body.dataset.tab === el.dataset.tab) closeOverlay();
    else openTab(el.dataset.tab);
  });
});

/* clicking column content makes it the active tab;
   clicking empty screen (outside any text) closes the overlay */
$('#overlay').addEventListener('click', (e) => {
  if (e.target.closest('#close-overlay')) return;
  const content = e.target.closest('.col-label, .col-body, .p-head, .p-bio, #p-assoc, #email');
  if (content) {
    const col = content.closest('.col');
    const tab = col.classList.contains('col-manifesto') ? 'manifesto'
      : col.classList.contains('col-personnel') ? 'personnel' : 'inquire';
    if (body.dataset.tab !== tab) openTab(tab);
  } else {
    closeOverlay();
  }
});

$('#close-overlay').addEventListener('click', closeOverlay);
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && body.classList.contains('overlay')) closeOverlay();
});

/* ---------- personnel accordion: one open at a time ---------- */

const rows = $$('.p-row');
rows.forEach((row) => {
  row.querySelector('.p-head').addEventListener('click', (e) => {
    if (e.target.closest('a')) return;      // LinkedIn clicks don't toggle
    const wasOpen = row.classList.contains('open');
    rows.forEach((r) => r.classList.remove('open'));
    if (!wasOpen) row.classList.add('open');
  });
});
