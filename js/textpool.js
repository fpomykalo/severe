// Text pool — real-time canvas text with a lingering ripple wake.
//
// Layout is done DOM-free with @chenglou/pretext (prepareWithSegments +
// layoutWithLines), the engine behind the pretextjs.dev "text pool" showcase.
// Every word is a particle anchored to its laid-out home position. The cursor
// stirs nearby words (impulse from cursor velocity + a radial push); a soft
// spring with low damping drags them home slowly, which produces the lingering
// wave. Disturbance also drives per-word "heat": here heat makes words MORE
// TRANSPARENT while the wave passes (the inverse of the pretext demo, where
// the resting text is light and darkens under the cursor).

import { prepareWithSegments, layoutWithLines } from '../vendor/pretext/layout.js'

const SPRING = 0.018      // pull back to home (lower = longer linger)
const DAMP = 0.935        // velocity damping (higher = wavier, longer settle)
const RADIUS = 75         // cursor influence radius, px
const DRAG = 0.16         // how much cursor velocity is transferred
const RADIAL = 1.2        // outward push from the cursor
const MAXV = 6            // velocity clamp — keeps fast swipes from flinging words
const HEAT_DECAY = 0.975  // per-frame heat decay (opacity recovery)
const HEAT_ALPHA = 0.72   // max opacity drop at full heat

export class TextPool {
  constructor(canvas, paragraphs, opts = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.font = opts.font || '8px "Geist Mono"'
    this.size = opts.size || 8
    this.letterSpacing = opts.letterSpacing ?? 0.8
    this.lineHeight = opts.lineHeight || 11
    this.width = opts.width || 308
    this.baseColor = opts.baseColor || [64, 64, 64]     // #404040
    this.whiteColor = [255, 255, 255]
    this.whiteWords = opts.whiteWords ?? 0              // first N words drawn white
    this.words = []
    this.revealed = 0
    this.active = false
    this.pointer = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: 0, inside: false }
    this.height = 0

    // prepare() is the expensive one-time pass — keep it; relayout() only
    // reruns the pure-arithmetic line layout at a new width
    // pre-wrap keeps the ten-space run between a name and its copy visible
    // instead of collapsing it CSS-style
    this.prepared = paragraphs.map(p =>
      prepareWithSegments(p.toUpperCase(), this.font, { letterSpacing: this.letterSpacing, whiteSpace: 'pre-wrap' }))

    this.relayout(this.width)

    canvas.addEventListener('pointermove', e => this.onMove(e))
    canvas.addEventListener('pointerleave', () => { this.pointer.inside = false })
  }

  relayout(width) {
    this.width = width
    const frac = this.words.length ? this.revealed / this.words.length : 0
    this.words = []
    const spaceW = this.measure(' ')
    let y = 0
    let wordIndex = 0
    for (const prepared of this.prepared) {
      const { lines } = layoutWithLines(prepared, width, this.lineHeight)
      for (let i = 0; i < lines.length; i++) {
        const lineY = y + i * this.lineHeight + this.size
        let x = 0
        for (const token of lines[i].text.split(' ')) {
          if (token === '') { x += spaceW; continue }
          const w = this.measure(token)
          this.words.push({
            text: token,
            hx: x, hy: lineY,
            x, y: lineY,
            vx: 0, vy: 0,
            heat: 0,
            w,
            white: wordIndex < this.whiteWords,
          })
          wordIndex++
          x += w + spaceW
        }
      }
      y += lines.length * this.lineHeight + this.lineHeight // blank line between paragraphs
    }
    this.height = y - this.lineHeight + 4
    this.revealed = Math.round(frac * this.words.length)
    this.fit()
    this.active = true
  }

  measure(text) {
    const ctx = this.ctx
    ctx.font = this.font
    if ('letterSpacing' in ctx) ctx.letterSpacing = this.letterSpacing + 'px'
    return ctx.measureText(text).width
  }

  fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.dpr = dpr
    this.canvas.width = Math.ceil(this.width * dpr)
    this.canvas.height = Math.ceil(this.height * dpr)
    this.canvas.style.width = this.width + 'px'
    this.canvas.style.height = this.height + 'px'
  }

  onMove(e) {
    const r = this.canvas.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const now = performance.now()
    const dt = Math.min(now - (this.pointer.t || now), 50) || 16
    if (this.pointer.inside) {
      this.pointer.vx = (x - this.pointer.x) / dt * 16
      this.pointer.vy = (y - this.pointer.y) / dt * 16
    }
    this.pointer.x = x
    this.pointer.y = y
    this.pointer.t = now
    this.pointer.inside = true
    this.stir()
    this.active = true
  }

  stir() {
    const p = this.pointer
    const r2 = RADIUS * RADIUS
    for (const w of this.words) {
      const cx = w.x + w.w / 2
      const dx = cx - p.x
      const dy = w.y - this.size / 2 - p.y
      const d2 = dx * dx + dy * dy
      if (d2 > r2) continue
      const d = Math.sqrt(d2) || 1
      const fall = 1 - d / RADIUS
      w.vx += (p.vx * DRAG + (dx / d) * RADIAL) * fall
      w.vy += (p.vy * DRAG + (dy / d) * RADIAL) * fall
      const v = Math.hypot(w.vx, w.vy)
      if (v > MAXV) { w.vx = w.vx / v * MAXV; w.vy = w.vy / v * MAXV }
      const speed = Math.min(1, Math.hypot(p.vx, p.vy) / 24 + 0.25)
      w.heat = Math.min(1, w.heat + fall * speed * 0.6)
    }
  }

  // fraction 0..1 of words shown — driven by the master write-on timeline,
  // forward and backward alike
  setReveal(frac) {
    const n = Math.round(Math.max(0, Math.min(1, frac)) * this.words.length)
    if (n !== this.revealed) {
      this.revealed = n
      this.active = true
    }
  }

  step() {
    if (!this.active) return false

    let energy = 0
    for (const w of this.words) {
      w.vx += (w.hx - w.x) * SPRING
      w.vy += (w.hy - w.y) * SPRING
      w.vx *= DAMP
      w.vy *= DAMP
      w.x += w.vx
      w.y += w.vy
      w.heat *= HEAT_DECAY
      if (w.heat < 0.004) w.heat = 0
      energy += w.vx * w.vx + w.vy * w.vy + w.heat
    }

    this.draw()

    if (energy < 0.001 && !this.pointer.inside) {
      this.active = false
    }
    return true
  }

  draw() {
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.font = this.font
    if ('letterSpacing' in ctx) ctx.letterSpacing = this.letterSpacing + 'px'
    ctx.textBaseline = 'alphabetic'

    const [br, bg, bb] = this.baseColor
    const [wr, wg, wb] = this.whiteColor

    for (let i = 0; i < this.revealed; i++) {
      const w = this.words[i]
      const alpha = 1 - HEAT_ALPHA * w.heat
      ctx.fillStyle = w.white ? `rgba(${wr},${wg},${wb},${alpha})` : `rgba(${br},${bg},${bb},${alpha})`
      const hot = w.heat > 0.02 || Math.abs(w.x - w.hx) > 0.2 || Math.abs(w.y - w.hy) > 0.2
      if (hot) {
        const rot = Math.max(-0.12, Math.min(0.12, w.vx * 0.015))
        ctx.save()
        ctx.translate(w.x + w.w / 2, w.y)
        ctx.rotate(rot)
        ctx.fillText(w.text, -w.w / 2, 0)
        ctx.restore()
      } else {
        ctx.fillText(w.text, w.x, w.y)
      }
    }
  }
}
