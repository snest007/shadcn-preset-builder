/**
 * Preset encode/decode utilities — exactly matches shadcn/create's format.
 * Bit-packs design system params into a single integer, encodes as base62
 * with a version prefix character ("b" = V2).
 *
 * Source: shadcn-ui/packages/shadcn/src/preset/preset.ts
 * Rules for compat: never reorder value arrays, only append.
 */

import type { DesignSystemConfig } from "./types"

// ─── Value arrays (order fixed — must match shadcn source exactly) ────────────

export const PRESET_STYLES = ["nova", "vega", "maia", "lyra", "mira", "luma"] as const

export const PRESET_BASE_COLORS = [
  "neutral", "stone", "zinc", "gray", "mauve", "olive", "mist", "taupe",
] as const

export const PRESET_THEMES = [
  "neutral", "stone", "zinc", "gray",
  "amber", "blue", "cyan", "emerald", "fuchsia", "green", "indigo",
  "lime", "orange", "pink", "purple", "red", "rose", "sky", "teal",
  "violet", "yellow", "mauve", "olive", "mist", "taupe",
] as const

export const PRESET_CHART_COLORS = PRESET_THEMES

export const PRESET_ICON_LIBRARIES = [
  "lucide", "hugeicons", "tabler", "phosphor", "remixicon",
] as const

export const PRESET_FONTS = [
  "inter", "noto-sans", "nunito-sans", "figtree", "roboto", "raleway",
  "dm-sans", "public-sans", "outfit", "jetbrains-mono", "geist",
  "geist-mono", "lora", "merriweather", "playfair-display", "noto-serif",
  "roboto-slab", "oxanium", "manrope", "space-grotesk", "montserrat",
  "ibm-plex-sans", "source-sans-3", "instrument-sans",
] as const

export const PRESET_FONT_HEADINGS = ["inherit", ...PRESET_FONTS] as const

export const PRESET_RADII = ["default", "none", "small", "medium", "large"] as const

export const PRESET_MENU_ACCENTS = ["subtle", "bold"] as const

export const PRESET_MENU_COLORS = [
  "default", "inverted", "default-translucent", "inverted-translucent",
] as const

// V1 fields (prefix "a") — 40 bits
const PRESET_FIELDS_V1 = [
  { key: "menuColor",    values: PRESET_MENU_COLORS,     bits: 3 },
  { key: "menuAccent",   values: PRESET_MENU_ACCENTS,    bits: 3 },
  { key: "radius",       values: PRESET_RADII,           bits: 4 },
  { key: "font",         values: PRESET_FONTS,           bits: 6 },
  { key: "iconLibrary",  values: PRESET_ICON_LIBRARIES,  bits: 6 },
  { key: "theme",        values: PRESET_THEMES,          bits: 6 },
  { key: "baseColor",    values: PRESET_BASE_COLORS,     bits: 6 },
  { key: "style",        values: PRESET_STYLES,          bits: 6 },
] as const

// V2 fields (prefix "b") — 51 bits
const PRESET_FIELDS_V2 = [
  ...PRESET_FIELDS_V1,
  { key: "chartColor",   values: PRESET_CHART_COLORS,    bits: 6 },
  { key: "fontHeading",  values: PRESET_FONT_HEADINGS,   bits: 5 },
] as const

// ─── Local name normalization ─────────────────────────────────────────────────
// Our theme-data.ts uses "remix" but shadcn uses "remixicon"

function normalizeIconLib(name: string): string {
  return name === "remix" ? "remixicon" : name
}
function denormalizeIconLib(name: string): string {
  return name === "remixicon" ? "remix" : name
}

// ─── Base62 ───────────────────────────────────────────────────────────────────

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

function toBase62(num: number): string {
  if (num === 0) return "0"
  let result = ""
  let n = num
  while (n > 0) {
    result = BASE62[n % 62] + result
    n = Math.floor(n / 62)
  }
  return result
}

function fromBase62(str: string): number {
  let result = 0
  for (let i = 0; i < str.length; i++) {
    const idx = BASE62.indexOf(str[i])
    if (idx === -1) return -1
    result = result * 62 + idx
  }
  return result
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Encode a DesignSystemConfig into a shadcn-compatible preset code.
 * Returns a string like "bX3z..." (always V2 format).
 */
export function encodePreset(config: DesignSystemConfig): string {
  const merged: Record<string, string> = {}
  for (const f of PRESET_FIELDS_V2) {
    merged[f.key] = f.values[0] as string
  }
  Object.assign(merged, config)
  merged.iconLibrary = normalizeIconLib(config.iconLibrary ?? "lucide")

  let bits = 0
  let offset = 0
  for (const field of PRESET_FIELDS_V2) {
    const val = merged[field.key as keyof typeof merged] as string
    const idx = (field.values as readonly string[]).indexOf(val)
    bits += (idx === -1 ? 0 : idx) * Math.pow(2, offset)
    offset += field.bits
  }

  return "b" + toBase62(bits)
}

/**
 * Decode a shadcn preset code ("b..." or "a...") into a partial config.
 * Returns null for invalid codes.
 */
export function decodePreset(code: string): Partial<DesignSystemConfig> | null {
  if (!code || code.length < 2) return null

  const version = code[0]
  if (version !== "a" && version !== "b") return null

  const fields = version === "a" ? PRESET_FIELDS_V1 : PRESET_FIELDS_V2
  const bits = fromBase62(code.slice(1))
  if (bits < 0) return null

  const result: Record<string, string> = {}
  let offset = 0
  for (const field of fields) {
    const idx = Math.floor(bits / Math.pow(2, offset)) % Math.pow(2, field.bits)
    result[field.key] = idx < field.values.length ? field.values[idx] : field.values[0]
    offset += field.bits
  }

  if (version === "a") {
    result.fontHeading = "inherit"
    result.chartColor = result.baseColor  // V1: chartColor follows baseColor
  }

  // Denormalize icon library name
  if (result.iconLibrary) {
    result.iconLibrary = denormalizeIconLib(result.iconLibrary)
  }

  return result as Partial<DesignSystemConfig>
}

/** Check if a string looks like a preset code. */
export function isPresetCode(value: string): boolean {
  if (!value || value.length < 2 || value.length > 10) return false
  if (value[0] !== "a" && value[0] !== "b") return false
  for (let i = 1; i < value.length; i++) {
    if (BASE62.indexOf(value[i]) === -1) return false
  }
  return true
}
