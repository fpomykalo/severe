// Halftone reveal — ported from react-bits' HalftoneReveal (ogl → raw WebGL2).
// https://reactbits.dev/animations/halftone-reveal
// Settings in use: mono halftone, dotDensity 100, dotSize 0.8, contrast 1,
// revealRadius 0.6, edge 0.9, follow 0.1, ink #1A1A1A on black paper.
// Extra behaviour: the textured image swaps to a random other one after every
// ~180px of cursor travel, so moving around the page flips through the set.

const VERTEX = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D tMap;
uniform vec2 iResolution;
uniform vec2 uImageSize;
uniform vec2 uMouse;
uniform float uActivity;

uniform float uDotSize;
uniform float uDensity;
uniform float uAngle;
uniform vec3 uInk;
uniform vec3 uPaper;
uniform float uContrast;

uniform float uRevealRadius;
uniform float uEdge;

in vec2 vUv;
out vec4 fragColor;

vec2 uAspect() {
  return vec2(iResolution.x / max(iResolution.y, 1.0), 1.0);
}

vec2 coverUv(vec2 uv) {
  float ia = uImageSize.x / max(uImageSize.y, 1.0);
  float pa = iResolution.x / max(iResolution.y, 1.0);
  vec2 s = pa > ia ? vec2(1.0, ia / pa) : vec2(pa / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}

vec3 gradeRGB(vec3 c) {
  return clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);
}

mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

vec4 sampleCell(vec2 st, float dens, float ang) {
  vec2 rp = rot(ang) * st * dens;
  vec2 center = floor(rp) + 0.5;
  vec2 stC = rot(-ang) * (center / dens);
  vec2 uvC = stC / uAspect();
  return texture(tMap, clamp(coverUv(uvC), 0.0, 1.0));
}

float coverage(vec2 st, float dens, float ang, float ink, float rscale) {
  vec2 rp = rot(ang) * st * dens;
  vec2 f = fract(rp) - 0.5;
  float d = length(f);
  float r = sqrt(clamp(ink, 0.0, 1.0)) * 0.72 * rscale * uDotSize;
  float w = length(fwidth(rp)) * 0.6 + 1e-4;
  return smoothstep(r + w, r - w, d);
}

void main() {
  vec2 aspect = uAspect();
  vec2 st = vUv * aspect;
  float ang = radians(uAngle);

  vec2 duv = (vUv - uMouse) * aspect;
  float dist = length(duv);

  float act = uActivity;
  float radius = max(uRevealRadius, 1e-4) * mix(0.4, 1.0, act);

  float px = 1.4 / max(iResolution.y, 1.0);
  float band = max(px, radius * (1.0 - clamp(uEdge, 0.0, 1.0)) * 0.45);
  float loupe = 1.0 - smoothstep(radius - band, radius + band, dist);
  float focus = clamp(loupe * act, 0.0, 1.0);

  float lum = dot(gradeRGB(sampleCell(st, uDensity, ang).rgb), vec3(0.299, 0.587, 0.114));
  float cov = coverage(st, uDensity, ang, 1.0 - lum, 1.0);
  vec3 print = mix(uPaper, uInk, cov);

  float t = clamp(dist / radius, 0.0, 1.0);
  float bend = t * t * t * t;
  vec2 dir = dist > 1e-5 ? duv / dist : vec2(0.0);
  vec2 off = dir * bend * radius * 0.22 / aspect;
  vec2 ca = dir * bend * 0.0045 / aspect;
  vec3 sharp = gradeRGB(vec3(
    texture(tMap, clamp(coverUv(vUv - off - ca), 0.0, 1.0)).r,
    texture(tMap, clamp(coverUv(vUv - off), 0.0, 1.0)).g,
    texture(tMap, clamp(coverUv(vUv - off + ca), 0.0, 1.0)).b
  ));

  fragColor = vec4(mix(print, sharp, focus), 1.0);
}
`

const hexToRgb = hex => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [0, 0, 0]
}

const SWAP_INTERVAL = 140 // ms between image swaps while the pointer is moving
const MOVE_WINDOW = 120   // pointer counts as "moving" this long after a move

export class HalftoneReveal {
  constructor(container, sources, opts = {}) {
    this.container = container
    this.follow = opts.follow ?? 0.1
    this.mouse = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5, active: 0, target: 0 }
    this.deck = []       // shuffled play order — every image shows before repeats
    this.lastMove = 0
    this.lastSwap = 0
    this.raf = null
    this.prev = 0
    this.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'display:block;width:100%;height:100%'
    container.appendChild(canvas)
    this.canvas = canvas

    const gl = canvas.getContext('webgl2', { alpha: false, antialias: true })
    this.gl = gl
    gl.clearColor(0, 0, 0, 1)

    const compile = (type, src) => {
      const sh = gl.createShader(type)
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh))
      return sh
    }
    const prog = gl.createProgram()
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog))
    gl.useProgram(prog)
    this.prog = prog

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'position')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    this.u = {}
    for (const name of ['tMap', 'iResolution', 'uImageSize', 'uMouse', 'uActivity', 'uDotSize',
      'uDensity', 'uAngle', 'uInk', 'uPaper', 'uContrast', 'uRevealRadius', 'uEdge']) {
      this.u[name] = gl.getUniformLocation(prog, name)
    }

    gl.uniform1f(this.u.uDotSize, opts.dotSize ?? 0.8)
    gl.uniform1f(this.u.uDensity, opts.dotDensity ?? 100)
    gl.uniform1f(this.u.uAngle, opts.angle ?? 45)
    gl.uniform3fv(this.u.uInk, hexToRgb(opts.inkColor ?? '#1A1A1A'))
    gl.uniform3fv(this.u.uPaper, hexToRgb(opts.paperColor ?? '#000000'))
    gl.uniform1f(this.u.uContrast, opts.contrast ?? 1)
    this.baseRadius = opts.revealRadius ?? 0.6
    gl.uniform1f(this.u.uRevealRadius, this.baseRadius)
    gl.uniform1f(this.u.uEdge, opts.edge ?? 0.9)
    gl.uniform1i(this.u.tMap, 0)

    this.texture = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
    gl.uniform2f(this.u.uImageSize, 1, 1)

    // preload all images; show a random one first
    this.images = sources.map(src => {
      const img = new Image()
      img.src = src
      return img
    })
    this.current = -1
    const first = Math.floor(Math.random() * this.images.length)
    const firstImg = this.images[first]
    if (firstImg.complete) this.setImage(first)
    else firstImg.onload = () => { if (this.current === -1) this.setImage(first) }
    this.images.forEach(img => { if (!img.complete) img.addEventListener('error', () => {}) })

    this.onMove = e => {
      const rect = container.getBoundingClientRect()
      this.mouse.x = (e.clientX - rect.left) / rect.width
      this.mouse.y = 1 - (e.clientY - rect.top) / rect.height
      this.mouse.target = this.reduced ? 0 : 1
      this.lastMove = performance.now()
    }
    this.onLeave = () => { this.mouse.target = 0 }
    // listen on the whole overlay (opts.eventTarget) so hovering the header
    // text, wordmark, or the X keeps driving the reveal
    const target = opts.eventTarget || container
    target.addEventListener('pointermove', this.onMove, { passive: true })
    target.addEventListener('pointerenter', this.onMove, { passive: true })
    target.addEventListener('pointerleave', this.onLeave, { passive: true })

    this.resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = container.clientWidth || 1
      const h = container.clientHeight || 1
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(this.u.iResolution, canvas.width, canvas.height)
      // the shader normalizes distances by height; on portrait screens shrink
      // the reveal so the lens doesn't swallow the whole display
      gl.uniform1f(this.u.uRevealRadius, w < h ? this.baseRadius * 0.58 : this.baseRadius)
    }
    this.ro = new ResizeObserver(this.resize)
    this.ro.observe(container)
    this.resize()
  }

  setImage(i) {
    const img = this.images[i]
    if (!img.complete || !img.naturalWidth) return
    this.current = i
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.uniform2f(this.u.uImageSize, img.naturalWidth, img.naturalHeight)
  }

  // random order over ALL images: draw from a reshuffled deck so the full set
  // cycles before anything repeats
  swapRandom() {
    if (!this.deck.length) {
      this.deck = this.images.map((img, i) => i)
        .filter(i => i !== this.current && this.images[i].complete && this.images[i].naturalWidth)
      for (let i = this.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]]
      }
    }
    if (!this.deck.length) return
    this.setImage(this.deck.pop())
  }

  start() {
    if (this.raf) return
    this.prev = performance.now()
    const loop = now => {
      this.raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, Math.max(0.001, (now - this.prev) / 1000))
      this.prev = now
      const m = this.mouse
      const a = 1 - Math.exp(-dt / Math.max(0.001, this.follow))
      m.sx += (m.x - m.sx) * a
      m.sy += (m.y - m.sy) * a
      const ba = 1 - Math.exp(-dt / 0.18)
      m.active += (m.target - m.active) * ba
      // while the pointer moves, keep cycling images in random order
      if (now - this.lastMove < MOVE_WINDOW && now - this.lastSwap > SWAP_INTERVAL) {
        this.lastSwap = now
        this.swapRandom()
      }
      const gl = this.gl
      gl.uniform2f(this.u.uMouse, m.sx, m.sy)
      gl.uniform1f(this.u.uActivity, m.active)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = null
  }
}
