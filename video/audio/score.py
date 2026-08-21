"""SEVERE — temp score.

Synthesised, not licensed music: a sub drone, tape hiss, and percussive hits
placed on the film's own structure. Board cuts get impacts, glitch events get
stabs, and the two big reveals get risers, so the music is cut to the picture
rather than the picture to the music.

Renders 48kHz stereo WAV. Everything is deterministic.
"""
import numpy as np
import struct

SR = 48_000
DUR = 32.4                      # 31.6s of picture plus a tail

# --- the film's own structure ---------------------------------------------
BOARDS = [0.0, 2.0, 4.0, 4.4, 5.6, 7.2, 7.6, 8.8, 11.8, 13.8, 15.0, 17.0,
          19.2, 21.2, 22.6, 24.0, 24.6, 27.2, 30.6, 31.6]
REVEALS = [19.2, 24.6]          # the lockup, and the big S
BLACK = (24.0, 24.6)            # the held beat: everything drops away
END = 30.6                      # the final glitch

def hash11(p):
    p = (p * 0.1031) % 1.0
    if p < 0: p += 1
    p *= p + 33.33
    p *= p + p
    return p % 1.0

def glitch_events():
    """The same deterministic schedule the renderer uses."""
    out, t, i = [], 0.55, 0
    while t < DUR:
        dur = 0.10 + hash11(i * 3.17) * 0.28
        out.append((t, dur))
        t += dur + 1.5 + hash11(i * 7.31) * 1.7
        i += 1
    return out

n = int(DUR * SR)
t = np.arange(n) / SR
rng = np.random.default_rng(7)

def band(x, lo, hi):
    """Zero-phase band limit, via the spectrum. Cheap and exact enough here."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, n=len(x))

def env(start, attack, decay):
    """One-shot envelope: near-instant attack, exponential decay."""
    e = np.zeros(n)
    i0 = int(start * SR)
    if i0 >= n: return e
    k = np.arange(n - i0) / SR
    e[i0:] = np.where(k < attack, k / max(attack, 1e-6), np.exp(-(k - attack) / decay))
    return e

def place(dst, src, start):
    i0 = int(start * SR)
    m = min(len(dst) - i0, len(src))
    if m > 0: dst[i0:i0 + m] += src[:m]

# --- 1. sub drone ----------------------------------------------------------
# E1 with a detuned partner and a fifth above. Slow swell, and it ducks out
# under the black beat so the silence there is real.
drone = np.zeros(n)
for f, a, d in [(41.20, 1.00, 0.0), (41.20, 0.55, 0.13), (61.74, 0.30, 0.0),
                (82.41, 0.18, 0.07)]:
    drone += a * np.sin(2 * np.pi * (f + d) * t + hash11(f) * 6.283)
drone *= 0.5 + 0.5 * np.sin(2 * np.pi * 0.055 * t - 1.4)      # slow breathing
swell = np.clip(t / 3.5, 0, 1) * np.clip((DUR - t) / 2.0, 0, 1)
drone *= swell

# --- 2. tape hiss ----------------------------------------------------------
hiss = band(rng.normal(0, 1, n), 700, 12_000) * 0.055
hiss *= 0.7 + 0.3 * np.sin(2 * np.pi * 0.21 * t)

# --- 3. a hit on every board cut ------------------------------------------
hits = np.zeros(n)
for i, b in enumerate(BOARDS[:-1]):
    weight = 1.0 if b in REVEALS else (0.55 + 0.45 * hash11(i * 5.7))
    k = np.arange(int(0.9 * SR)) / SR
    # pitched thump: a short downward sweep
    thump = np.sin(2 * np.pi * (95 * np.exp(-k * 9) + 38) * k) * np.exp(-k / 0.16)
    # and a filtered noise transient on top of it
    body = band(rng.normal(0, 1, len(k)), 60, 1800) * np.exp(-k / 0.055)
    place(hits, (thump * 0.85 + body * 0.45) * weight, b)

# --- 4. a stab on every glitch event --------------------------------------
stabs = np.zeros(n)
for j, (gt, gd) in enumerate(glitch_events()):
    k = np.arange(int(min(gd + 0.25, 0.5) * SR)) / SR
    lo = 900 + 2600 * hash11(j * 2.3)
    s = band(rng.normal(0, 1, len(k)), lo, lo + 3200) * np.exp(-k / (gd * 0.55))
    place(stabs, s * 0.30, gt)

# --- 5. risers into the two reveals ---------------------------------------
rise = np.zeros(n)
for r in REVEALS:
    k = np.arange(int(1.6 * SR)) / SR
    p = k / k[-1]
    up = band(rng.normal(0, 1, len(k)), 200, 9000) * (p ** 3)
    tone = np.sin(2 * np.pi * (120 * 2 ** (p * 2.2)) * k) * (p ** 4) * 0.5
    place(rise, (up * 0.5 + tone) * 0.55, max(0, r - 1.6))

# --- 6. the black beat: pull everything down ------------------------------
duck = np.ones(n)
i0, i1 = int(BLACK[0] * SR), int(BLACK[1] * SR)
duck[i0:i1] = np.linspace(1, 0.06, i1 - i0)
duck[i1:i1 + SR // 3] = np.linspace(0.06, 1, min(SR // 3, n - i1))

# --- 7. the final tear ----------------------------------------------------
k = np.arange(int(1.4 * SR)) / SR
final = (band(rng.normal(0, 1, len(k)), 80, 7000) * np.exp(-k / 0.30) * 0.8
         + np.sin(2 * np.pi * (70 * np.exp(-k * 5) + 33) * k) * np.exp(-k / 0.45))
place(hits, final * 1.1, END)

mix = drone * 0.42 * duck + hiss * duck + hits * 0.85 + stabs * duck + rise * 0.7

# soft clip, then leave 1 dB of headroom
mix = np.tanh(mix * 1.15)
mix *= 0.89 / np.max(np.abs(mix))

# a hair of stereo width on the noise layers only; the sub stays centred
side = band(rng.normal(0, 1, n), 2000, 11_000) * 0.012
left, right = mix + side, mix - side

pcm = np.stack([left, right], axis=1)
pcm = (np.clip(pcm, -1, 1) * 32767).astype('<i2')
data = pcm.tobytes()
hdr = (b'RIFF' + struct.pack('<I', 36 + len(data)) + b'WAVEfmt ' +
       struct.pack('<IHHIIHH', 16, 1, 2, SR, SR * 4, 4, 16) +
       b'data' + struct.pack('<I', len(data)))
open('/home/user/severe/video/audio/score.wav', 'wb').write(hdr + data)
print(f"wrote score.wav  {DUR}s  peak {np.max(np.abs(pcm))/32767:.3f}")
print(f"  {len(BOARDS)-1} board hits, {len(glitch_events())} glitch stabs, "
      f"{len(REVEALS)} risers")
