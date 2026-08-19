// sub rosa v2 — scroll morph (Home 3 → Home 2), live write-on/write-out,
// text pools with clickable founder names, showcase overlay (Home 4) with
// halftone reveal, manifesto page (Home 6/7 desktop, iPhone 16-6 mobile).

import { TextPool } from './textpool2.js'
import { HalftoneReveal } from './halftone.js'

/* ---------------------------------------------------------------- content */

const P_LONG = `Brand is infrastructure, and it only works if the person who has never opened the guidelines can still use it without breaking anything. That way of thinking came from working in-house. As Global Creative Lead at Palantir he built the brand across every platform, AIP, Foundry, Gotham and Apollo, and handed it to more than four thousand colleagues who used it every day. At FluidStack he led brand design through a period of fast growth. Earlier years were spent at Pentagram, Wieden+Kennedy, Landor, Mother London and Further, on work for Coca-Cola, Nike, Johnnie Walker and Nokia.`
const P_BIO = `Brand designer and creative director based in London, working with technology companies, startups and the investors who back them. Sixteen years in, he measures a brand by one thing: how well it holds up once he has left the room.`
// kito's and zivan's copies of the bio end mid-sentence in Figma — verbatim
const P_BIO_CUT = P_BIO.slice(0, -' has left the room.'.length) + '.'

const GAP = ' '.repeat(10)

const COLUMNS = [
  { id: 'col-0', name: 'kito kitev',     paras: [P_LONG, P_BIO_CUT], url: 'https://www.linkedin.com/in/kkitev/' },
  { id: 'col-1', name: 'Filip Pomykalo', paras: [P_BIO, P_LONG],     url: 'https://www.linkedin.com/in/filip-pomykalo/' },
  { id: 'col-2', name: 'zivan rosic',    paras: [P_LONG, P_BIO_CUT], url: 'https://www.linkedin.com/in/zivanrosic/' },
  { id: 'col-3', name: 'noah smith',     paras: [P_BIO, P_LONG],     url: 'https://www.linkedin.com/in/noahjoelsmith/' },
]

// Showcase reel: set to the video URL (e.g. 'assets/v1-v2/reel.mp4') once the
// asset lands — the halftone lens then reveals the single looping reel
// instead of cycling the stills (same effect, no randomization)
const SHOWCASE_VIDEO = null

const SHOWCASE_IMAGES = [
  'AIPCon2.jpg',
  'Apollo Logo.jpg',
  'CCP Composition.jpg',
  'Davos23.jpg',
  'DevCon3.jpg',
  'Ferrari.jpg',
  'HKD-03.jpg',
  'Iphone14Pro_Mockup01_MicroVolume.jpg',
  'Open Two Fold Brochure Mockup.jpg',
  'Sub-branding Wayfinding.jpg',
  'Superology WIP-01.jpg',
  'Superology WIP-03.jpg',
].map(f => encodeURI('assets/v1-v2/images/' + f))

/* ------------------------------------------------------------- typewriter */

function collectTextNodes(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const nodes = []
  let n
  while ((n = walker.nextNode())) if (n.nodeValue.trim() !== '' || n.nodeValue.includes(' ')) nodes.push(n)
  return nodes
}

class Typewriter {
  constructor(el) {
    this.el = el
    this.nodes = collectTextNodes(el)
    this.full = this.nodes.map(n => n.nodeValue)
    this.total = this.full.reduce((s, t) => s + t.length, 0)
    this.dur = +el.dataset.typeDur || 500
    this.delay = +el.dataset.typeDelay || 0
    this.applyAt(0)
  }
  // t: position on the master write timeline (ms); idempotent, works both ways
  applyAt(t) {
    const local = Math.max(0, Math.min(1, (t - this.delay) / this.dur))
    const count = Math.round(this.total * local)
    let left = count
    this.nodes.forEach((n, i) => {
      const take = Math.max(0, Math.min(this.full[i].length, left))
      const next = this.full[i].slice(0, take)
      if (n.nodeValue !== next) n.nodeValue = next
      left -= this.full[i].length
    })
  }
}

/* ------------------------------------------------------------------ clock */

function clockString(timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone,
  }).formatToParts(new Date())
  const get = t => parts.find(p => p.type === t).value
  return `${get('hour')}:${get('minute')}.${get('second')}`
}

// text node → owning typewriter; lets the clocks update WITHOUT replacing the
// nodes the typewriters hold (textContent would detach them, which made the
// times appear glued together before their separating spaces typed in)
const nodeOwners = new Map()

function setClockText(el, str) {
  const tn = el.firstChild
  if (!tn || tn.nodeType !== 3) { el.textContent = str; return }
  const owner = nodeOwners.get(tn)
  if (owner) {
    owner.typer.full[owner.index] = str
    owner.typer.applyAt(W) // re-render at the current timeline position
  } else {
    tn.nodeValue = str
  }
}

function stampClocks() {
  const lon = clockString('Europe/London')
  const ny = clockString('America/New_York')
  document.querySelectorAll('.clock-lon').forEach(el => setClockText(el, lon))
  document.querySelectorAll('.clock-ny').forEach(el => setClockText(el, ny))
}

/* ------------------------------------------------------------- morph rig */

const morph = document.getElementById('morph')
const flipper = document.getElementById('flipper')
const scene1Caption = document.getElementById('scene1-caption')
const scene2 = document.getElementById('scene2')
const spacer = document.getElementById('scroll-spacer')

// rose logo box after the morph (rose-logo 2 is 41.4:50, narrower than v1's)
const logoEnd = () => (window.innerWidth <= 600
  ? { x: 20, y: 20, w: 30, h: 36 }
  : { x: 80, y: 55, w: 41, h: 50 })

const scrollRange = () => Math.round(window.innerHeight * 1.4)

let introLocked = false // mobile: once the morph completes, the intro is gone

function sizeSpacer() {
  // mobile content is taller than the viewport — extra scroll after the morph
  // scrolls the written page itself
  const extra = Math.max(0, contentHeight - window.innerHeight)
  const range = introLocked ? 0 : scrollRange()
  spacer.style.height = window.innerHeight + range + extra + 'px'
}

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const lerp = (a, b, t) => a + (b - a) * t

function applyMorph(p, extra = 0) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const e = easeInOut(p)
  const END = logoEnd()

  const w0 = Math.min(416, vw - 40)
  const h0 = w0 * 412 / 416

  const cx0 = vw / 2, cy0 = vh / 2 - 33          // Home 3: centered, offset -33px
  const cx1 = END.x + END.w / 2, cy1 = END.y + END.h / 2 - extra

  const w = lerp(w0, END.w, e)
  const h = lerp(h0, END.h, e)
  const cx = lerp(cx0, cx1, e)
  const cy = lerp(cy0, cy1, e)

  morph.style.width = w + 'px'
  morph.style.height = h + 'px'
  morph.style.transform = `translate(${cx - w / 2}px, ${cy - h / 2}px)`
  flipper.style.transform = `rotateY(${e * 180}deg)`

  scene1Caption.style.opacity = Math.max(0, 1 - p * 3)
}

/* ----------------------------------------------- write-on master timeline
   One clock drives every typed element and the canvas pools. Scrolling past
   the morph plays it forward; scrolling back plays the same timeline in
   reverse, so the page writes itself out and then deletes itself the same
   way. */

const POOL_DELAY = i => 700 + i * 120
const POOL_DUR = 1100

let typers = []
let pools = []
let nameLinks = []
let TL_TOTAL = 2400
let W = 0                 // current position on the timeline (ms)
let Wtarget = 0
let driverRaf = null
let driverPrev = 0
let clockTimer = null

function applyTimeline() {
  for (const ty of typers) ty.applyAt(W)
  pools.forEach((pool, i) => pool.setReveal((W - POOL_DELAY(i)) / POOL_DUR))
  syncNameLinks()
  scene2.classList.toggle('visible', W > 0)
  scene2.classList.toggle('interactive', W >= TL_TOTAL)

  const full = W >= TL_TOTAL
  if (full && !clockTimer) {
    stampClocks()
    clockTimer = setInterval(stampClocks, 250)
  } else if (!full && clockTimer) {
    clearInterval(clockTimer)
    clockTimer = null
  }
}

function driveTimeline() {
  if (driverRaf) return
  driverPrev = performance.now()
  const frame = now => {
    const dt = now - driverPrev
    driverPrev = now
    const dir = Math.sign(Wtarget - W)
    W = dir > 0 ? Math.min(Wtarget, W + dt) : Math.max(Wtarget, W - dt)
    applyTimeline()
    runPools()
    if (W !== Wtarget) {
      driverRaf = requestAnimationFrame(frame)
    } else {
      driverRaf = null
    }
  }
  driverRaf = requestAnimationFrame(frame)
}

function setWriteTarget(t) {
  if (Wtarget === t) return
  Wtarget = t
  if (t > 0) stampClocks() // real times are in place before their glyphs appear
  driveTimeline()
}

/* -------------------------------------------------------------- pool loop */

let poolsRunning = false
function runPools() {
  if (poolsRunning) return
  poolsRunning = true
  const frame = () => {
    let any = false
    for (const p of pools) if (p.step()) any = true
    if (any) requestAnimationFrame(frame)
    else poolsRunning = false
  }
  requestAnimationFrame(frame)
}

/* ------------------------------------------------------------------ scroll */

let showcaseOpen = false
let manifestoOpen = false

function onScroll() {
  if (showcaseOpen || manifestoOpen) return

  if (introLocked) {
    // mobile after the intro: the page top IS the main layout. The header
    // (logo, wordmark, latin, cities) is fixed and collapses over the first
    // 200px of scroll (iPhone 16-5); the headline and columns scroll under
    // the black header mask.
    headerCollapse = Math.min(1, window.scrollY / 200)
    applyMobileHeader(headerCollapse, '#scene2')
    applyMorph(1)
    scrollContent(window.scrollY)
    setWriteTarget(TL_TOTAL)
    return
  }

  const p = Math.min(1, Math.max(0, window.scrollY / scrollRange()))

  // mobile: completing the morph permanently retires the intro (until a
  // fresh page load) — collapse its scroll region and re-anchor
  if (p >= 0.999 && isMobile()) {
    introLocked = true
    const past = Math.max(0, window.scrollY - scrollRange())
    sizeSpacer()
    window.scrollTo(0, past)
    scene1Caption.style.display = 'none'
    onScroll()
    return
  }

  applyMorph(p)
  scrollContent(0)
  setWriteTarget(p >= 0.999 ? TL_TOTAL : 0)
}

// translate only the below-the-header content (headline + columns)
function scrollContent(extra) {
  const t = extra ? `0 ${-extra}px` : ''
  document.querySelectorAll('.headline').forEach(el => { el.style.translate = t })
  document.getElementById('cols').style.translate = t
}

/* ------------------------------------------------------------- name links
   The founder names are real <a> elements over the canvas pools — clickable,
   underlined on hover, excluded from the cursor mechanic. Each word appears
   with the master write-on timeline, exactly like the canvas words. */

function buildNameLinks() {
  COLUMNS.forEach(({ id, name, url }) => {
    const holder = document.getElementById(id)
    const a = document.createElement('a')
    a.className = 'name-link'
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener'
    const parts = name.split(' ')
    parts.forEach((word, j) => {
      const span = document.createElement('span')
      span.textContent = word + (j < parts.length - 1 ? ' ' : '')
      a.appendChild(span)
    })
    holder.appendChild(a)
    nameLinks.push(a)
  })
  positionNameLinks()
}

// baseline-align the DOM name with the canvas words on the same line. The
// canvas draws at an alphabetic baseline of hy; measure where the DOM puts
// the baseline inside a .name-link-styled box (a zero-size inline-block
// marker sits exactly on the text baseline) and offset the link's top so the
// two coincide — works at every viewport, zoom and DPR, in every browser,
// with no dependency on text-box support
function positionNameLinks() {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;' +
    'font:400 8px "Geist Mono",monospace;letter-spacing:0.8px;line-height:normal;' +
    'text-transform:uppercase;white-space:pre;'
  probe.textContent = 'KITO'
  const marker = document.createElement('span')
  marker.style.cssText = 'display:inline-block;width:0;height:0;'
  probe.appendChild(marker)
  document.body.appendChild(probe)
  const baseline = marker.getBoundingClientRect().top - probe.getBoundingClientRect().top
  probe.remove()

  nameLinks.forEach((a, i) => {
    const w0 = pools[i] && pools[i].words[0]
    if (!w0) return
    a.style.left = w0.hx + 'px'
    a.style.top = (w0.hy - baseline) + 'px'
  })
}

function syncNameLinks() {
  nameLinks.forEach((a, i) => {
    const pool = pools[i]
    if (!pool) return
    ;[...a.children].forEach((span, j) => span.classList.toggle('on', j < pool.revealed))
  })
}

/* ----------------------------------------------------------- title scale
   Scale the whole "sub rosa" composition uniformly so sub's ink sits on the
   second column rail (filip) and rosa's ink ends on the right content
   margin — Home 2 with four columns. Both words grow proportionally. */

let rosaNaturalW = 0
let titleNaturalH = 0   // trimmed cap height of the wordmark at natural size
let latinNaturalH = 16  // the latin caption block height (16 desktop / 26 mobile)
let rosaInkOffset = 0   // left side bearing of the "r" glyph at natural size
let subInkOffset = 0    // left side bearing of the "s" glyph at natural size
let rosaInkW = 0        // ink width of "rosa" (box minus side bearings)
let subNaturalW = 0     // natural box width of "sub"

// Home 2/6 at 1440: sub box 391, rosa box 880, rosa ink ends 1360 → the
// composition's ink span (sub ink start → rosa ink end) is 960 at 240px,
// with rosa's box offset 489 from sub's. Collapsed one-line (Home 7 /
// iPhone 16-5): rosa box offset 458, cap height 62.
const TITLE_SPAN = 960
const ROSA_BOX_DELTA = 489
const ROSA_BOX_DELTA_COLLAPSED = 458

const isMobile = () => window.innerWidth <= 600

let mobileColsTop = 0   // set by fitTitle, consumed by layoutColumns
let contentHeight = 0   // total document height on mobile (set by layoutColumns)
let mobileHeader = null // expanded/collapsed header geometry (set by fitTitle)
let headerCollapse = 0  // 0 = expanded (16-2), 1 = collapsed (16-5)
let deskHeader = null   // desktop header geometry incl. collapsed state (manifesto)

// interpolate the mobile header between its expanded and collapsed states
function applyMobileHeader(c, scope) {
  const m = mobileHeader
  if (!m) return
  const L = (a, b) => a + (b - a) * c
  const q = sel => document.querySelectorAll(scope + ' ' + sel)
  const s = L(m.s1, m.s2)

  q('.pos-sub').forEach(el => {
    el.style.left = Math.round(L(m.sub1.left, m.sub2.left)) + 'px'
    el.style.top = Math.round(L(m.sub1.top, m.sub2.top)) + 'px'
    el.style.transform = `scale(${s})`
  })
  q('.pos-rosa').forEach(el => {
    el.style.left = Math.round(L(m.rosa1.left, m.rosa2.left)) + 'px'
    el.style.top = Math.round(L(m.rosa1.top, m.rosa2.top)) + 'px'
    el.style.transform = `scale(${s})`
  })
  q('.pos-r').forEach(el => {
    el.style.right = 'auto'
    el.style.left = Math.round(L(m.r1.left, m.r2.left)) + 'px'
    el.style.top = Math.round(L(m.r1.top, m.r2.top)) + 'px'
  })
  const navTop = Math.round(L(m.navTop1, m.navTop2))
  q('.pos-latin').forEach(el => { el.style.top = navTop + 'px'; el.style.left = m.rail + 'px' })
  q('.pos-cities').forEach(el => {
    el.style.top = navTop + 'px'
    el.style.left = Math.round(L(m.cities1Left, m.cities2Left)) + 'px'
    el.style.right = 'auto'
  })
  if (scope === '#scene2') {
    const mask = document.getElementById('header-mask')
    if (mask) mask.style.height = (navTop + 26 + 20) + 'px'
  }
  if (scope === '#showcase') {
    // mobile X is bottom-centered (CSS) — clear any inline top from desktop
    const closeBtn = document.getElementById('close-showcase')
    if (closeBtn) closeBtn.style.top = 'auto'
  }
}

function fitTitle() {
  if (!rosaNaturalW) return
  const closeBtn = document.getElementById('close-showcase')

  if (isMobile()) {
    // iPhone frames: expanded (16-2) — sub and rosa stack big; collapsed
    // (16-5) — one small "sub rosa" line beside the logo. Scrolling down
    // interpolates between the two states.
    const rail = 20
    const vw = window.innerWidth
    const s1 = Math.max(0.2, (vw - 40) / rosaInkW)
    const s2 = s1 * (62 / 129)  // collapsed cap height ratio from the frames

    const navTop1 = Math.round(38 + 153 * s1 + titleNaturalH * s1 + 20)
    const navTop2 = Math.round(54 + titleNaturalH * s2 + 20)

    mobileHeader = {
      rail, vw, s1, s2, navTop1, navTop2,
      sub1: { left: rail - subInkOffset * s1, top: 38 },
      sub2: { left: rail - subInkOffset * s2, top: 54 },
      rosa1: { left: rail - rosaInkOffset * s1, top: Math.round(38 + 153 * s1) },
      rosa2: { left: rail - subInkOffset * s2 + ROSA_BOX_DELTA_COLLAPSED * s2, top: 54 },
      r1: { left: rail - subInkOffset * s1 + (subNaturalW - 8) * s1, top: 38 + 40 * s1 },
      r2: { left: vw - 33, top: 55 },
      cities1Left: vw - 171, // cities block right edge (…Detroit) at vw-20
      cities2Left: rail - subInkOffset * s2 + (ROSA_BOX_DELTA_COLLAPSED + rosaInkOffset) * s2,
    }

    applyMobileHeader(headerCollapse, '#scene2')
    // the showcase and manifesto overlays mirror the header in their state
    applyMobileHeader(headerCollapse, '#showcase')
    applyMobileHeader(mfC, '#manifesto') // manifesto collapses with its own scroll

    const headTop = navTop1 + 26 + 40  // latin block is 3 lines on mobile
    ;[['hl-1', 0], ['hl-2', 26], ['hl-3', 52]].forEach(([cls, off]) => {
      const el = document.querySelector('#scene2 .' + cls)
      if (el) {
        el.style.top = (headTop + off) + 'px'
        el.style.left = rail + 'px'
      }
    })

    mobileColsTop = headTop + 169
    return
  }

  // desktop (Home 2/6): sub's ink anchors on the second column rail (filip
  // pomykalo); rosa's ink ends on the right content margin. The 960px ink
  // span of the whole composition sets the uniform scale. The rail is
  // computed, not read from the DOM — during a mobile→desktop resize the
  // columns still carry their mobile inline styles when this runs.
  const vw = window.innerWidth
  const rail2 = 80 + (vw - 160 - 3 * 16) / 4 + 16
  const s = Math.max(0.2, (vw - 80 - rail2) / TITLE_SPAN)

  const subLeft1 = rail2 - subInkOffset * s
  const rosaLeft1 = subLeft1 + ROSA_BOX_DELTA * s
  const citiesLeft = rosaLeft1 + rosaInkOffset * s
  const navTop1 = Math.round(15 + titleNaturalH * s + 20)

  // collapsed header (Home 7, manifesto page): small one-line "sub rosa" on
  // the same rail, cap height 62, nav row at 125
  const s2 = 62 / titleNaturalH
  const subLeft2 = rail2 - subInkOffset * s2
  const rosaLeft2 = subLeft2 + ROSA_BOX_DELTA_COLLAPSED * s2
  const navTop2 = 43 + 62 + 20

  deskHeader = { s1: s, s2, rail2, navTop1, navTop2, subLeft1, subLeft2, rosaLeft1, rosaLeft2, citiesLeft }

  // shift each box left by its first glyph's side bearing so INK sits on rails
  document.querySelectorAll('.pos-sub').forEach(el => {
    el.style.left = Math.round(subLeft1) + 'px'
    el.style.top = '15px'
    el.style.transform = `scale(${s})`
  })
  document.querySelectorAll('.pos-r').forEach(el => {
    el.style.left = 'auto'
    el.style.right = '80px'
    el.style.top = '38px'
  })
  document.querySelectorAll('.pos-rosa').forEach(el => {
    el.style.left = Math.round(rosaLeft1) + 'px'
    el.style.top = '15px'
    el.style.transform = `scale(${s})`
  })

  // nav row: 20px under the scaled title
  document.querySelectorAll('.pos-deployed, .pos-latin, .pos-cities, .pos-links')
    .forEach(el => { el.style.top = navTop1 + 'px' })

  // latin block on sub's rail; cities on rosa's ink
  document.querySelectorAll('.pos-latin').forEach(el => { el.style.left = rail2 + 'px' })
  document.querySelectorAll('.pos-cities').forEach(el => { el.style.left = Math.round(citiesLeft) + 'px' })

  // headline: 40px under the latin block, aligned with sub's rail
  const headTop = navTop1 + latinNaturalH + 40
  ;[['hl-1', 0], ['hl-2', 26], ['hl-3', 52]].forEach(([cls, off]) => {
    const el = document.querySelector('#scene2 .' + cls)
    if (el) {
      el.style.top = (headTop + off) + 'px'
      el.style.left = rail2 + 'px'
    }
  })

  // showcase X: under Manifesto+/showcase+, right-aligned with them, 20px away
  if (closeBtn) closeBtn.style.top = (navTop1 + latinNaturalH + 20) + 'px'
}

/* --------------------------------------------------------------- showcase */

const showcaseEl = document.getElementById('showcase')
let halftone = null

function openShowcase() {
  if (showcaseOpen) return
  showcaseOpen = true
  stampClocks()
  showcaseEl.hidden = false
  document.body.style.overflow = 'hidden'
  if (!halftone) {
    halftone = new HalftoneReveal(document.getElementById('halftone'), SHOWCASE_IMAGES, {
      dotDensity: 100,
      dotSize: 0.8,
      contrast: 1,
      revealRadius: 0.6,
      edge: 0.9,
      follow: 0.1,
      inkColor: '#1A1A1A',
      paperColor: '#000000',
      eventTarget: showcaseEl,
      video: SHOWCASE_VIDEO,
    })
  }
  fitTitle()
  halftone.start()
}

function closeShowcase() {
  if (!showcaseOpen) return
  showcaseOpen = false
  showcaseEl.hidden = true
  document.body.style.overflow = manifestoOpen ? 'hidden' : ''
  if (halftone) halftone.stop()
  // openShowcase ran fitTitle, which resets every header (the manifesto's
  // included) to the expanded state — restore the manifesto's real position
  if (manifestoOpen) applyManifestoHeader(mfC)
}

/* -------------------------------------------------------------- manifesto
   Home 6 → Home 7 (desktop): a scrollable overlay page. The fixed header
   collapses over the first 200px of scroll — the big title shrinks to a
   one-line "sub rosa" at top 43 and the nav row rises from under the title
   to 125. On mobile (iPhone 16 - 6) the header is always collapsed. */

const manifestoEl = document.getElementById('manifesto')
let mfC = 0        // manifesto header collapse 0..1
let mfLabelTop0 = 0 // natural (scroll-0) top of the manifesto label block

// The label and X live in the fixed layer: they scroll up with the content
// until they sit 50px under the header block (wordmark + nav row), then lock
// there while the body copy keeps scrolling under the black mask.
function applyManifestoHeader(c) {
  const st = manifestoEl.scrollTop
  const label = document.getElementById('mf-label')
  const closeBtn = document.getElementById('close-manifesto')
  const mask = document.getElementById('mf-mask')

  if (isMobile()) {
    const m = mobileHeader
    if (!m) return
    applyMobileHeader(c, '#manifesto')
    const navTop = Math.round(m.navTop1 + (m.navTop2 - m.navTop1) * c)
    const labelTop = Math.round(Math.max(mfLabelTop0 - st, navTop + 26 + 50))
    label.style.top = labelTop + 'px'
    closeBtn.style.top = (labelTop - 19) + 'px'
    // the body is full-width here, so the mask extends past the pinned
    // label + X before the copy re-emerges
    mask.style.height = (labelTop + 36 + 20) + 'px'
    return
  }
  const d = deskHeader
  if (!d) return
  const L = (a, b) => a + (b - a) * c
  const q = sel => document.querySelectorAll('#manifesto ' + sel)
  const s = L(d.s1, d.s2)

  q('.pos-sub').forEach(el => {
    el.style.left = Math.round(L(d.subLeft1, d.subLeft2)) + 'px'
    el.style.top = Math.round(L(15, 43)) + 'px'
    el.style.transform = `scale(${s})`
  })
  q('.pos-rosa').forEach(el => {
    el.style.left = Math.round(L(d.rosaLeft1, d.rosaLeft2)) + 'px'
    el.style.top = Math.round(L(15, 43)) + 'px'
    el.style.transform = `scale(${s})`
  })
  const navTop = Math.round(L(d.navTop1, d.navTop2))
  // one scoped query per class — a grouped selector would only scope its
  // first item and leak onto the scene2/showcase headers
  for (const sel of ['.pos-deployed', '.pos-latin', '.pos-cities', '.pos-links']) {
    q(sel).forEach(el => { el.style.top = navTop + 'px' })
  }
  q('.pos-latin').forEach(el => { el.style.left = d.rail2 + 'px' })
  q('.pos-cities').forEach(el => { el.style.left = Math.round(d.citiesLeft) + 'px' })

  const labelTop = Math.round(Math.max(mfLabelTop0 - st, navTop + latinNaturalH + 50))
  label.style.top = labelTop + 'px'
  closeBtn.style.top = labelTop + 'px'

  document.getElementById('mf-mask').style.height = (navTop + latinNaturalH + 20) + 'px'
}

function fitManifesto() {
  const label = document.getElementById('mf-label')
  const body = document.getElementById('mf-body')
  const topLink = document.getElementById('mf-top')
  const closeBtn = document.getElementById('close-manifesto')
  const content = document.getElementById('mf-content')
  const vw = window.innerWidth

  if (isMobile()) {
    const m = mobileHeader
    if (!m) return
    // same mechanic as the homepage: the header opens expanded (16-2) and
    // collapses over the first 200px of scroll; the label sits 50px under
    // it, the X right-aligned at vw-20 centered on the label, the body 70px
    // under the label
    mfLabelTop0 = m.navTop1 + 26 + 50
    closeBtn.style.left = (vw - 75) + 'px'
    body.style.left = '20px'
    body.style.top = (mfLabelTop0 + 16 + 70) + 'px'
    body.style.width = (vw - 40) + 'px'
    const h = body.offsetHeight
    const topTop = mfLabelTop0 + 16 + 70 + h + 70
    topLink.style.left = '20px'
    topLink.style.top = topTop + 'px'
    content.style.height = (topTop + 6 + 104) + 'px'
    applyManifestoHeader(mfC)
    return
  }

  const d = deskHeader
  if (!d) return
  // Home 6: headline as on Home 2; label/X/body top 104px under it (y 434
  // at 1440×900); body spans two column widths (632) on sub's rail; "top of
  // the page" 70px under the body, 104px bottom padding
  const headTop = d.navTop1 + latinNaturalH + 40
  const mfHeadline = document.querySelector('.mf-headline')
  mfHeadline.style.left = d.rail2 + 'px'
  mfHeadline.style.top = headTop + 'px'

  const mTop = headTop + 69 + 104
  mfLabelTop0 = mTop
  closeBtn.style.left = (vw - 80 - 55) + 'px'
  body.style.left = d.rail2 + 'px'
  body.style.top = mTop + 'px'
  body.style.width = (2 * d.rail2 - 176) + 'px' // two columns + one gutter
  const h = body.offsetHeight
  const topTop = mTop + h + 70
  topLink.style.left = d.rail2 + 'px'
  topLink.style.top = topTop + 'px'
  content.style.height = (topTop + 6 + 104) + 'px'
  applyManifestoHeader(mfC)
}

function openManifesto() {
  if (manifestoOpen) return
  manifestoOpen = true
  stampClocks()
  manifestoEl.hidden = false
  document.body.style.overflow = 'hidden'
  manifestoEl.scrollTop = 0
  mfC = 0
  fitManifesto()
}

function closeManifesto() {
  if (!manifestoOpen) return
  manifestoOpen = false
  manifestoEl.hidden = true
  document.body.style.overflow = ''
}

/* ------------------------------------------------------- responsive cols */

function layoutColumns() {
  const cols = document.getElementById('cols')
  const mobile = isMobile()

  COLUMNS.forEach(({ id }, i) => {
    const holder = document.getElementById(id)
    // on mobile every column is full width and they stack with 40px gaps
    if (mobile) {
      holder.style.width = '100%'
      holder.style.left = '0'
    } else {
      holder.style.width = ''
      holder.style.left = ''
    }
    const width = holder.clientWidth
    const pool = pools[i]
    if (pool && width > 0 && Math.abs(width - pool.width) > 0.5) {
      pool.relayout(width)
      holder.style.height = pool.height + 'px'
    }
  })

  if (mobile) {
    let y = 0
    COLUMNS.forEach(({ id }, i) => {
      const holder = document.getElementById(id)
      holder.style.top = y + 'px'
      y += (pools[i] ? pools[i].height : 0) + 40
    })
    const total = Math.max(0, y - 40)
    cols.style.height = total + 'px'
    cols.style.top = mobileColsTop + 'px'
    contentHeight = mobileColsTop + total + 21
  } else {
    COLUMNS.forEach(({ id }) => { document.getElementById(id).style.top = '' })
    const h = Math.max(...pools.map(p => p.height), 0)
    cols.style.height = h + 'px'
    cols.style.top = Math.round(window.innerHeight - 30 - h) + 'px'
    contentHeight = 0
  }
  positionNameLinks()
  runPools()
}

/* ------------------------------------------------------------------- init */

async function init() {
  // position the morph and spacer immediately — before waiting on fonts —
  // so a hard refresh never flashes the illustration in the corner
  sizeSpacer()
  applyMorph(Math.min(1, Math.max(0, window.scrollY / scrollRange())))

  try {
    await Promise.all([
      document.fonts.load('8px "Geist Mono"'),
      document.fonts.load('700 240px "Geist"'),
      document.fonts.load('500 24px "Geist"'),
      document.fonts.load('400 16px "Geist"'),
    ])
    await document.fonts.ready
  } catch { /* fall back to system fonts */ }

  for (const { id, name, paras } of COLUMNS) {
    const holder = document.getElementById(id)
    const canvas = document.createElement('canvas')
    holder.appendChild(canvas)
    const [first, ...rest] = paras
    const pool = new TextPool(canvas, [name + GAP + first, ...rest], {
      font: '8px "Geist Mono", monospace',
      size: 8,
      letterSpacing: 0.8,
      lineHeight: 11,
      width: holder.clientWidth || 308,
      baseColor: [64, 64, 64],
      staticWords: name.split(' ').length,
    })
    holder.style.height = pool.height + 'px'
    pools.push(pool)
  }
  const cols = document.getElementById('cols')
  {
    const h = Math.max(...pools.map(p => p.height), 0)
    cols.style.height = h + 'px'
    cols.style.top = Math.round(window.innerHeight - 30 - h) + 'px'
  }
  buildNameLinks()
  cols.addEventListener('pointermove', runPools)

  // natural wordmark metrics, measured while the elements still hold their
  // full text (the typewriters blank them right after)
  rosaNaturalW = document.getElementById('wm-rosa').offsetWidth
  subNaturalW = document.getElementById('wm-sub').offsetWidth
  titleNaturalH = document.getElementById('wm-sub').offsetHeight
  latinNaturalH = document.querySelector('#scene2 .pos-latin').offsetHeight
  // ink metrics of the wordmark at 240px, pixel-measured with the real
  // ss01/ss04 alternate glyphs (canvas measureText can't apply font features)
  rosaInkOffset = 16
  subInkOffset = 9
  rosaInkW = 464
  fitTitle()

  typers = [...document.querySelectorAll('[data-type]')].map(el => new Typewriter(el))
  typers.forEach(typer => typer.nodes.forEach((n, index) => nodeOwners.set(n, { typer, index })))
  stampClocks()
  TL_TOTAL = Math.max(
    ...typers.map(t => t.delay + t.dur),
    ...pools.map((_, i) => POOL_DELAY(i) + POOL_DUR),
  )

  document.querySelectorAll('.open-showcase').forEach(el =>
    el.addEventListener('click', e => { e.preventDefault(); openShowcase() }))
  document.querySelectorAll('.open-manifesto').forEach(el =>
    el.addEventListener('click', e => { e.preventDefault(); openManifesto() }))
  document.getElementById('close-showcase').addEventListener('click', closeShowcase)
  document.getElementById('close-manifesto').addEventListener('click', closeManifesto)
  document.getElementById('mf-top').addEventListener('click', e => {
    e.preventDefault()
    manifestoEl.scrollTo({ top: 0, behavior: 'smooth' })
  })
  manifestoEl.addEventListener('scroll', () => {
    mfC = Math.min(1, manifestoEl.scrollTop / 200)
    applyManifestoHeader(mfC)
  }, { passive: true })

  // mobile menu
  const menu = document.getElementById('menu')
  const openMenu = () => { menu.hidden = false; document.body.classList.add('menu-open') }
  const closeMenu = () => { menu.hidden = true; document.body.classList.remove('menu-open') }
  document.getElementById('menu-btn').addEventListener('click', openMenu)
  document.getElementById('sc-menu-btn').addEventListener('click', openMenu)
  document.getElementById('mf-menu-btn').addEventListener('click', openMenu)
  document.getElementById('close-menu').addEventListener('click', closeMenu)
  document.getElementById('menu-showcase').addEventListener('click', e => {
    e.preventDefault()
    closeMenu()
    openShowcase()
  })
  document.getElementById('menu-manifesto').addEventListener('click', e => {
    e.preventDefault()
    closeMenu()
    openManifesto()
  })
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return
    if (showcaseOpen) closeShowcase()
    else if (!menu.hidden) closeMenu()
    else if (manifestoOpen) closeManifesto()
  })

  fitTitle()
  layoutColumns()
  sizeSpacer()
  onScroll()

  window.addEventListener('resize', () => {
    if (introLocked && !isMobile()) {
      // growing back to desktop from the locked mobile state: the one-way
      // intro is a mobile-only concept — restore the reversible desktop
      // intro, parked at its end (morph complete, page written)
      introLocked = false
      scene1Caption.style.display = ''
      sizeSpacer()
      window.scrollTo(0, scrollRange())
    }
    fitTitle()
    layoutColumns()
    sizeSpacer()
    onScroll()
    if (manifestoOpen) fitManifesto()
  })
  window.addEventListener('scroll', onScroll, { passive: true })
}

init()
