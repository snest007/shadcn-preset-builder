/** OKLCH → Figma RGBA (0–1 range) */

function oklchToLinearSRGB(l: number, c: number, hDeg: number) {
  const h = (hDeg * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)

  // OKLab → linear sRGB
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b

  const lv = l_ * l_ * l_
  const mv = m_ * m_ * m_
  const sv = s_ * s_ * s_

  return {
    r: +4.0767416621 * lv - 3.3077115913 * mv + 0.2309699292 * sv,
    g: -1.2684380046 * lv + 2.6097574011 * mv - 0.3413193965 * sv,
    b: -0.0041960863 * lv - 0.7034186147 * mv + 1.707614701 * sv,
  }
}

function linearToGamma(x: number): number {
  if (x <= 0.0031308) return 12.92 * x
  return 1.055 * Math.pow(x, 1 / 2.4) - 0.055
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/**
 * Parse an OKLCH CSS string and return a Figma-compatible RGBA object.
 * Handles:
 *   "oklch(0.145 0 0)"
 *   "oklch(1 0 0 / 10%)"
 *   "oklch(1 0 0 / 0.1)"
 */
export function parseOklch(str: string): { r: number; g: number; b: number; a: number } {
  const inner = str.match(/oklch\(([^)]+)\)/)?.[1]
  if (!inner) return { r: 0, g: 0, b: 0, a: 1 }

  const [colorPart, alphaPart] = inner.split("/").map((s) => s.trim())
  const [lStr, cStr, hStr] = colorPart.trim().split(/\s+/)

  const l = parseFloat(lStr)
  const c = parseFloat(cStr)
  const h = parseFloat(hStr) || 0

  let alpha = 1
  if (alphaPart) {
    const raw = alphaPart.trim()
    alpha = raw.endsWith("%") ? parseFloat(raw) / 100 : parseFloat(raw)
  }

  const lin = oklchToLinearSRGB(l, c, h)

  return {
    r: clamp(linearToGamma(lin.r)),
    g: clamp(linearToGamma(lin.g)),
    b: clamp(linearToGamma(lin.b)),
    a: clamp(alpha),
  }
}
