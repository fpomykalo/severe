/* SEVERE v3 — orchestration.
   Home 1: scramble reveal of SEVERE, scroll once to enter (one-way).
   Home 2/3: cursor movement cycles fullscreen images.
   Home 4/5: manifesto / personnel / inquire overlay with accordion bios. */

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const body = document.body;
const intro = $('#intro');
const bgImg = $('#bg-img');

/* ---------- image pool: assets/v3/images, one shuffled deck ---------- */

const IMAGES = [];
for (let i = 1; i <= 17; i++) IMAGES.push(`assets/v3/images/f/f${String(i).padStart(2, '0')}.jpg`);
for (let i = 1; i <= 21; i++) IMAGES.push(`assets/v3/images/z/z${String(i).padStart(2, '0')}.jpg`);
for (let i = IMAGES.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [IMAGES[i], IMAGES[j]] = [IMAGES[j], IMAGES[i]];
}

const loaded = [];
(function preload(i) {
  if (i >= IMAGES.length) return;
  const im = new Image();
  im.onload = () => { loaded.push(IMAGES[i]); preload(i + 1); };
  im.onerror = () => preload(i + 1);
  im.src = IMAGES[i];
})(0);

let bgIdx = -1;
let lastSwap = 0;
const SWAP_MS = 140;

addEventListener('pointermove', (e) => {
  if (body.dataset.state !== 'main' || body.classList.contains('overlay')) return;
  const now = performance.now();
  if (now - lastSwap < SWAP_MS || !loaded.length) return;
  lastSwap = now;
  bgIdx = (bgIdx + 1) % loaded.length;
  bgImg.src = loaded[bgIdx];
  bgImg.style.display = 'block';
});

/* ---------- live clocks: London / New York–Detroit, HH:MM.SS ---------- */

const fmtCache = {};
function timeIn(tz) {
  const f = fmtCache[tz] ||= new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const t = f.format(new Date());                 // "22:04:37"
  return t.slice(0, 5) + '.' + t.slice(6);        // "22:04.37"
}
function tickClock() {
  $('#clock-l').textContent = timeIn('Europe/London');
  $('#clock-r').textContent = timeIn('America/Detroit');
}
tickClock();
setInterval(tickClock, 250);

/* second clock column starts where it does in Figma: after "22:04.37" + 20 spaces */
document.fonts.ready.then(() => {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = '500 10px HaasDisp';
  const w = ctx.measureText('22:04.37                    ').width;
  document.documentElement.style.setProperty('--clock2', w + 'px');
});

/* ---------- Home 1: random letter/character offset reveal ---------- */

const SLOTS = $$('#hero-word span');
const FINAL = ['S', 'E', 'V', 'E', 'R', 'E'];
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&/*+=-';
const FLIP_MS = 45;

document.fonts.ready.then(() => {
  const t0 = performance.now() + 100;
  const settle = FINAL.map((_, i) => 600 + i * 160);
  let lastFlip = 0;
  (function frame(now) {
    if (now < t0) { requestAnimationFrame(frame); return; }
    const t = now - t0;
    let running = false;
    if (now - lastFlip >= FLIP_MS) {
      lastFlip = now;
      SLOTS.forEach((s, i) => {
        if (t >= settle[i]) s.textContent = FINAL[i];
        else s.textContent = CHARS[Math.floor(Math.random() * CHARS.length)];
      });
    }
    SLOTS.forEach((s, i) => { if (t < settle[i]) running = true; });
    if (running) requestAnimationFrame(frame);
    else SLOTS.forEach((s, i) => { s.textContent = FINAL[i]; });
  })(performance.now());
});

/* ---------- intro scroll: one-way transition into Home 2 ---------- */

function onScroll() {
  if (body.dataset.state !== 'intro') return;
  const y = scrollY;
  intro.style.transform = `translateY(${-y}px)`;
  if (y >= innerHeight) {
    body.dataset.state = 'main';
    scrollTo(0, 0);
  }
}
addEventListener('scroll', onScroll, { passive: true });

/* ---------- overlay (Home 4/5) ---------- */

function openTab(tab) {
  body.classList.add('overlay');
  body.dataset.tab = tab;
}
function closeOverlay() {
  body.classList.remove('overlay');
  body.removeAttribute('data-tab');
}

$$('.navitem, .col-label').forEach((el) => {
  el.addEventListener('click', () => {
    if (body.dataset.state !== 'main') return;
    openTab(el.dataset.tab);
  });
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
