// sub rosa — scroll morph (Home 3 → Home 2), live write-on/write-out,
// text pools, showcase overlay (Home 4) with halftone reveal.

import { TextPool } from './textpool.js'
import { HalftoneReveal } from './halftone.js'

/* ---------------------------------------------------------------- content */

const P1 = `Most identity work survives its launch and falls apart around month six, when the original designer is gone and a product manager is building a deck at eleven at night. Filip designs for that person. A system has to be rigorous enough to stay coherent across a thousand touchpoints and loose enough that someone who has never opened a guidelines document can use it without breaking anything. Brand is infrastructure. It should carry weight quietly and give the people inside a company something to build with. Guidelines are only a record of it. The real test is whether the logic underneath is clear enough for people to make good decisions on their own.`
const P2 = `That way of thinking came from working in-house. As Global Creative Lead at Palantir he built the brand across every platform, AIP, Foundry, Gotham and Apollo, and handed it to more than four thousand colleagues who used it every day. At FluidStack he led brand design through a period of fast growth. Earlier years were spent at Pentagram, Wieden+Kennedy, Landor, Mother London and Further, on work for Coca-Cola, Nike, Johnnie Walker and Nokia.`
const P3 = `brand designer and creative director based in London, working with technology companies, startups and the investors who back them. Sixteen years in, he measures a brand by one thing: how well it holds up once he has left the room.`

const GAP = ' '.repeat(10)

const COLUMNS = [
  { id: 'col-0', name: 'cody duma',      paras: [P2, P3, P1] },
  { id: 'col-1', name: 'kito kitev',     paras: [P1, P2, P3] },
  { id: 'col-2', name: 'filip pomykalo', paras: [P3, P1, P2] },
  { id: 'col-3', name: 'zivan rosic',    paras: [P2, P3, P1] },
  { id: 'col-4', name: 'noah smith',     paras: [P1, P2, P3] },
]

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
].map(f => encodeURI('assets/images/' + f))

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

// rose logo box after the morph: Home 2 on desktop, iPhone header on mobile
const logoEnd = () => (window.innerWidth <= 600
  ? { x: 20, y: 20, w: 48, h: 36 }
  : { x: 80, y: 55, w: 66, h: 50 })

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
let TL_TOTAL = 2400
let W = 0                 // current position on the timeline (ms)
let Wtarget = 0
let driverRaf = null
let driverPrev = 0
let clockTimer = null

function applyTimeline() {
  for (const ty of typers) ty.applyAt(W)
  pools.forEach((pool, i) => pool.setReveal((W - POOL_DELAY(i)) / POOL_DUR))
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

function onScroll() {
  if (showcaseOpen) return

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

/* ------------------------------------------------------------ rose cursor */

const roseCursor = document.getElementById('rose-cursor')

// the cursor lives on the columns wrapper, so it survives the gutters between
// columns but ends at the container's outer margins
function wireCursor(container) {
  container.addEventListener('pointermove', e => {
    roseCursor.style.transform = `translate(${e.clientX - 16.5}px, ${e.clientY - 12.5}px)`
    roseCursor.classList.add('on')
    runPools()
  })
  container.addEventListener('pointerleave', () => roseCursor.classList.remove('on'))
}

/* ----------------------------------------------------------- title scale
   Scale the whole "sub rosa" composition uniformly — anchored at sub's left
   edge — so rosa's right edge lands on the right content margin. Both words
   grow proportionally; nothing is stretched. */

let rosaNaturalW = 0
let titleNaturalH = 0   // trimmed cap height of the wordmark at natural size
let latinNaturalH = 16  // the latin caption block height (16 desktop / 26 mobile)
let rosaInkOffset = 0   // left side bearing of the "r" glyph at natural size
let subInkOffset = 0    // left side bearing of the "s" glyph at natural size
let rosaInkW = 0        // ink width of "rosa" (box minus side bearings)
let subNaturalW = 0     // natural box width of "sub"

const isMobile = () => window.innerWidth <= 600

let mobileColsTop = 0   // set by fitTitle, consumed by layoutColumns
let contentHeight = 0   // total document height on mobile (set by layoutColumns)
let mobileHeader = null // expanded/collapsed header geometry (set by fitTitle)
let headerCollapse = 0  // 0 = expanded (16-2), 1 = collapsed (16-5)

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
      rosa2: { left: rail - subInkOffset * s2 + 458 * s2, top: 54 },
      r1: { left: rail - subInkOffset * s1 + (subNaturalW - 8) * s1, top: 38 + 40 * s1 },
      r2: { left: vw - 33, top: 55 },
      cities1Left: vw - 171, // cities block right edge (…Detroit) at vw-20
      cities2Left: rail - subInkOffset * s2 + (458 + rosaInkOffset) * s2,
    }

    applyMobileHeader(headerCollapse, '#scene2')
    // the showcase overlay mirrors the page header's current state
    applyMobileHeader(headerCollapse, '#showcase')

    const headTop = navTop1 + 26 + 40  // latin block is 3 lines on mobile
    ;[['hl-1', 0], ['hl-2', 26], ['hl-3', 52]].forEach(([cls, off]) => {
      const el = document.querySelector('.' + cls)
      if (el) {
        el.style.top = (headTop + off) + 'px'
        el.style.left = rail + 'px'
      }
    })

    mobileColsTop = headTop + 169
    return
  }

  // desktop: rosa's INK spans exactly the last two columns (zivan + noah,
  // incl. their 16px gap) — that ratio sets the scale for the whole title.
  // sub keeps its ink anchored on the kito kitev column.
  const colsEl = document.getElementById('cols')
  const col1 = document.getElementById('col-1')  // kito
  const col3 = document.getElementById('col-3')  // zivan
  const subLeft = colsEl.offsetLeft + col1.offsetLeft
  const rosaLeft = colsEl.offsetLeft + col3.offsetLeft
  const rosaTargetW = (window.innerWidth - 80) - rosaLeft
  const s = Math.max(0.2, rosaTargetW / rosaInkW)

  // shift each box left by its first glyph's side bearing so INK sits on rails
  document.querySelectorAll('.pos-sub').forEach(el => {
    el.style.left = Math.round(subLeft - subInkOffset * s) + 'px'
    el.style.top = '15px'
    el.style.transform = `scale(${s})`
  })
  document.querySelectorAll('.pos-r').forEach(el => {
    el.style.left = 'auto'
    el.style.right = '80px'
    el.style.top = '38px'
  })
  document.querySelectorAll('.pos-rosa').forEach(el => {
    el.style.left = Math.round(rosaLeft - rosaInkOffset * s) + 'px'
    el.style.top = '15px'
    el.style.transform = `scale(${s})`
  })

  // nav row: 20px under the scaled title
  const navTop = Math.round(15 + titleNaturalH * s + 20)
  document.querySelectorAll('.pos-deployed, .pos-latin, .pos-cities, .pos-links')
    .forEach(el => { el.style.top = navTop + 'px' })

  // latin block on sub's rail; cities on the r's ink (= zivan's rail)
  document.querySelectorAll('.pos-latin').forEach(el => { el.style.left = subLeft + 'px' })
  document.querySelectorAll('.pos-cities').forEach(el => { el.style.left = rosaLeft + 'px' })

  // headline: 40px under the latin block, aligned with sub's rail
  const headTop = navTop + latinNaturalH + 40
  ;[['hl-1', 0], ['hl-2', 26], ['hl-3', 52]].forEach(([cls, off]) => {
    const el = document.querySelector('.' + cls)
    if (el) {
      el.style.top = (headTop + off) + 'px'
      el.style.left = subLeft + 'px'
    }
  })

  // showcase X: under Manifesto+/showcase+, right-aligned with them, 20px away
  if (closeBtn) closeBtn.style.top = (navTop + latinNaturalH + 20) + 'px'
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
    })
  }
  fitTitle()
  halftone.start()
}

function closeShowcase() {
  if (!showcaseOpen) return
  showcaseOpen = false
  showcaseEl.hidden = true
  document.body.style.overflow = ''
  if (halftone) halftone.stop()
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
      whiteWords: name.split(' ').length,
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
  wireCursor(cols)

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

  document.getElementById('open-showcase').addEventListener('click', e => { e.preventDefault(); openShowcase() })
  document.getElementById('close-showcase').addEventListener('click', closeShowcase)

  // mobile menu
  const menu = document.getElementById('menu')
  const openMenu = () => { menu.hidden = false; document.body.classList.add('menu-open') }
  const closeMenu = () => { menu.hidden = true; document.body.classList.remove('menu-open') }
  document.getElementById('menu-btn').addEventListener('click', openMenu)
  document.getElementById('sc-menu-btn').addEventListener('click', openMenu)
  document.getElementById('close-menu').addEventListener('click', closeMenu)
  document.getElementById('menu-showcase').addEventListener('click', e => {
    e.preventDefault()
    closeMenu()
    openShowcase()
  })
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeMenu(); closeShowcase() }
  })

  fitTitle()
  layoutColumns()
  sizeSpacer()
  onScroll()

  window.addEventListener('resize', () => { fitTitle(); layoutColumns(); sizeSpacer(); onScroll() })
  window.addEventListener('scroll', onScroll, { passive: true })
}

init()
