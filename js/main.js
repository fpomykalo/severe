// sub rosa — scroll morph (Home 3 → Home 2), live write-on, text pools.

import { TextPool } from './textpool.js'

/* ---------------------------------------------------------------- content */

const P1 = `Most identity work survives its launch and falls apart around month six, when the original designer is gone and a product manager is building a deck at eleven at night. Filip designs for that person. A system has to be rigorous enough to stay coherent across a thousand touchpoints and loose enough that someone who has never opened a guidelines document can use it without breaking anything. Brand is infrastructure. It should carry weight quietly and give the people inside a company something to build with. Guidelines are only a record of it. The real test is whether the logic underneath is clear enough for people to make good decisions on their own.`
const P2 = `That way of thinking came from working in-house. As Global Creative Lead at Palantir he built the brand across every platform, AIP, Foundry, Gotham and Apollo, and handed it to more than four thousand colleagues who used it every day. At FluidStack he led brand design through a period of fast growth. Earlier years were spent at Pentagram, Wieden+Kennedy, Landor, Mother London and Further, on work for Coca-Cola, Nike, Johnnie Walker and Nokia.`
const P3 = `brand designer and creative director based in London, working with technology companies, startups and the investors who back them. Sixteen years in, he measures a brand by one thing: how well it holds up once he has left the room.`

const GAP = ' '.repeat(10)

const COLUMNS = [
  { id: 'col-1', name: 'kito kitev',     paras: [P1, P2, P3] },
  { id: 'col-2', name: 'filip pomykalo', paras: [P3, P1, P2] },
  { id: 'col-3', name: 'zivan rosic',    paras: [P2, P3, P1] },
  { id: 'col-4', name: 'noah smith',     paras: [P1, P2, P3] },
]

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
    this.done = false
    this.clear()
  }
  clear() {
    for (const n of this.nodes) n.nodeValue = ''
    this.done = false
  }
  showAll() {
    this.nodes.forEach((n, i) => { n.nodeValue = this.full[i] })
    this.done = true
  }
  // t: ms since the write-on began
  tick(t) {
    if (this.done) return true
    const local = t - this.delay
    if (local <= 0) return false
    const count = Math.min(this.total, Math.ceil(this.total * (local / this.dur)))
    let left = count
    this.nodes.forEach((n, i) => {
      const take = Math.max(0, Math.min(this.full[i].length, left))
      const next = this.full[i].slice(0, take)
      if (n.nodeValue !== next) n.nodeValue = next
      left -= this.full[i].length
    })
    if (count >= this.total) this.done = true
    return this.done
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

function updateClocks() {
  const lon = document.getElementById('clock-lon')
  const ny = document.getElementById('clock-ny')
  if (lon.textContent !== '') {
    lon.textContent = clockString('Europe/London')
    ny.textContent = clockString('America/New_York')
  }
}

/* ------------------------------------------------------------- morph rig */

const morph = document.getElementById('morph')
const flipper = document.getElementById('flipper')
const scene1Caption = document.getElementById('scene1-caption')
const scene2 = document.getElementById('scene2')
const spacer = document.getElementById('scroll-spacer')

const END = { x: 80, y: 55, w: 66, h: 50 } // rose logo box in Home 2

const scrollRange = () => Math.round(window.innerHeight * 1.4)

function sizeSpacer() {
  spacer.style.height = window.innerHeight + scrollRange() + 'px'
}

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const lerp = (a, b, t) => a + (b - a) * t

function applyMorph(p) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const e = easeInOut(p)

  const cx0 = vw / 2, cy0 = vh / 2 - 33          // Home 3: centered, offset -33px
  const cx1 = END.x + END.w / 2, cy1 = END.y + END.h / 2

  const w = lerp(416, END.w, e)
  const h = lerp(412, END.h, e)
  const cx = lerp(cx0, cx1, e)
  const cy = lerp(cy0, cy1, e)

  morph.style.width = w + 'px'
  morph.style.height = h + 'px'
  morph.style.transform = `translate(${cx - w / 2}px, ${cy - h / 2}px)`
  flipper.style.transform = `rotateY(${e * 180}deg)`

  scene1Caption.style.opacity = Math.max(0, 1 - p * 3)
}

/* ------------------------------------------------------------ scene 2 rig */

let typers = []
let pools = []
let writeOnStarted = false
let writeOnDone = false
let writeOnT0 = 0
let clockTimer = null
let sceneVisible = false

function startWriteOn() {
  writeOnStarted = true
  writeOnT0 = performance.now()
  updateClocks() // stamp real times before their glyphs get revealed
  pools.forEach((pool, i) => setTimeout(() => { pool.reveal(1100); runPools() }, 700 + i * 120))
  requestAnimationFrame(writeOnFrame)
}

function writeOnFrame(now) {
  const t = now - writeOnT0
  let allDone = true
  for (const ty of typers) if (!ty.tick(t)) allDone = false
  if (!allDone) {
    requestAnimationFrame(writeOnFrame)
  } else {
    writeOnDone = true
    if (!clockTimer) clockTimer = setInterval(updateClocks, 250)
  }
}

function showScene2() {
  if (sceneVisible) return
  sceneVisible = true
  scene2.classList.add('visible')
  if (!writeOnStarted) {
    startWriteOn()
  } else {
    typers.forEach(t => t.showAll())
    pools.forEach(p => p.revealInstant())
  }
}

function hideScene2() {
  if (!sceneVisible) return
  sceneVisible = false
  scene2.classList.remove('visible')
}

/* -------------------------------------------------------------- main loop */

let poolsRunning = false
function runPools() {
  if (poolsRunning) return
  poolsRunning = true
  const frame = () => {
    let any = false
    for (const p of pools) if (p.step()) any = true
    if (any && sceneVisible) requestAnimationFrame(frame)
    else poolsRunning = false
  }
  requestAnimationFrame(frame)
}

function onScroll() {
  const p = Math.min(1, Math.max(0, window.scrollY / scrollRange()))
  applyMorph(p)
  if (p >= 0.999) { showScene2(); runPools() }
  else hideScene2()
}

/* ------------------------------------------------------------ rose cursor */

const roseCursor = document.getElementById('rose-cursor')

function wireCursor(canvas) {
  canvas.addEventListener('pointermove', e => {
    roseCursor.style.transform = `translate(${e.clientX - 16.5}px, ${e.clientY - 12.5}px)`
    roseCursor.classList.add('on')
    runPools()
  })
  canvas.addEventListener('pointerleave', () => roseCursor.classList.remove('on'))
}

/* ------------------------------------------------------------------- init */

async function init() {
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
      width: 308,
      baseColor: [64, 64, 64],
      whiteWords: name.split(' ').length,
    })
    holder.style.height = pool.height + 'px'
    pools.push(pool)
    wireCursor(canvas)
  }

  typers = [...document.querySelectorAll('[data-type]')].map(el => new Typewriter(el))

  sizeSpacer()
  onScroll()

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', () => { sizeSpacer(); onScroll() })
}

init()
