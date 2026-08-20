"""SEVERE brand video — plate look development.

Reference implementation of the plate treatment, in the order the shader stack
will run it. Deliberately numpy so the maths can be checked frame by frame;
the browser pipeline mirrors these steps in GLSL.

Order matters: grade -> blur (in LINEAR light) -> tint -> grain.
Blur must precede grain, and must run in linear light so highlights bloom
outward instead of averaging down to grey.
"""
import numpy as np

RED = np.array([1.0, 0.0, 0.0])          # #FF0000


def srgb_to_linear(c):
    c = np.clip(c, 0.0, 1.0)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    c = np.clip(c, 0.0, 1.0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def gaussian_kernel(sigma):
    r = max(1, int(np.ceil(sigma * 3)))
    x = np.arange(-r, r + 1, dtype=np.float64)
    k = np.exp(-(x ** 2) / (2 * sigma ** 2))
    return k / k.sum()


def blur_linear(y, sigma):
    """Separable Gaussian applied in linear light, so the specular catchlight
    blooms into a disc rather than being averaged away."""
    if sigma <= 0:
        return y
    k = gaussian_kernel(sigma)
    lin = srgb_to_linear(y)
    pad = len(k) // 2
    tmp = np.apply_along_axis(
        lambda m: np.convolve(np.pad(m, pad, mode="edge"), k, mode="valid"), 1, lin)
    out = np.apply_along_axis(
        lambda m: np.convolve(np.pad(m, pad, mode="edge"), k, mode="valid"), 0, tmp)
    return linear_to_srgb(out)


def grade(y, black=0.0, white=1.0, gamma=1.0):
    """Expand the plate's flat native range onto the delivery range. The plates
    arrive unclipped (eye 16-223, trees 12-218 of 255) precisely so this step
    has headroom in both directions."""
    y = (y - black) / max(1e-6, white - black)
    return np.clip(y, 0.0, 1.0) ** gamma


def tint_red(y):
    """Multiply blend of #FF0000 over greyscale == (luma, 0, 0).
    Plate luma therefore maps directly to red intensity."""
    return np.stack([y, np.zeros_like(y), np.zeros_like(y)], axis=-1)


def grain(img, sigma, seed, shadow_bias=0.6):
    """Additive film grain, weighted toward the mid-tones and shadows so the
    brightest areas stay comparatively clean, as in the reference stills."""
    rng = np.random.default_rng(seed)
    if img.ndim == 2:
        img = img[..., None]
    lum = img.max(axis=-1, keepdims=True)
    weight = 1.0 - shadow_bias * lum
    n = rng.normal(0.0, sigma / 255.0, img.shape[:2] + (1,))
    return np.clip(img + n * weight, 0.0, 1.0)
