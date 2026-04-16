/// <reference types="@figma/plugin-typings" />

import { parseOklch } from "@shared/color-utils"
import {
  THEMES,
  FONTS,
  RADII,
  DEFAULT_CONFIG,
  getTheme,
  getFont,
  getRadiusValue,
} from "@shared/theme-data"
import type { DesignSystemConfig, PluginMessage, UIMessage } from "@shared/types"

figma.showUI(__html__, { width: 320, height: 620, themeColors: false })

// ─── Collection IDs (discovered at runtime) ───────────────────────────────────

const COLL_TAILWIND = "VariableCollectionId:1:2"
const COLL_THEME    = "VariableCollectionId:1:412"
const COLL_MODE     = "VariableCollectionId:1:444"
const COLL_CUSTOM   = "VariableCollectionId:17548:88924"
const COLL_ICONS    = "VariableCollectionId:21003:91179"

const TW_MODE_ID    = "1:0"   // TailwindCSS collection "Default" mode

// ─── Variable Registry ────────────────────────────────────────────────────────

type Registry = {
  themeCollection:  VariableCollection
  modeCollection:   VariableCollection
  customCollection: VariableCollection | null
  iconCollection:   VariableCollection | null
  byName:           Map<string, Variable>
  twLookup:         Map<string, string>   // "r,g,b,a" → variableId (Tailwind colors)
}

async function buildRegistry(): Promise<Registry> {
  const allCollections = await figma.variables.getLocalVariableCollectionsAsync()
  const allVars = await figma.variables.getLocalVariablesAsync()

  const themeCollection = allCollections.find((c) => c.id === COLL_THEME)!
  const modeCollection  = allCollections.find((c) => c.id === COLL_MODE)!
  const customCollection = allCollections.find((c) => c.id === COLL_CUSTOM) ?? null
  const iconCollection   = allCollections.find((c) => c.id === COLL_ICONS) ?? null

  const byName = new Map<string, Variable>()
  for (const v of allVars) {
    byName.set(v.name, v)
  }

  // Build Tailwind color lookup: normalized "r,g,b,a" → variableId
  const twLookup = new Map<string, string>()
  for (const v of allVars) {
    if (v.variableCollectionId !== COLL_TAILWIND || v.resolvedType !== "COLOR") continue
    const raw = v.valuesByMode[TW_MODE_ID]
    if (raw && typeof raw === "object" && "r" in raw) {
      const val = raw as RGBA
      const key = rgbaKey(val)
      twLookup.set(key, v.id)
    }
  }

  return { themeCollection, modeCollection, customCollection, iconCollection, byName, twLookup }
}

function rgbaKey(c: RGBA): string {
  return `${c.r.toFixed(3)},${c.g.toFixed(3)},${c.b.toFixed(3)},${c.a.toFixed(3)}`
}

// ─── Color Apply ─────────────────────────────────────────────────────────────

/** Set a Collection 2 color variable in targetModeId, preferring Tailwind alias */
function applyColorVar(
  reg: Registry,
  varName: string,
  oklch: string | undefined,
  targetModeId: string,
  alphaOverride?: number,
) {
  if (!oklch) return
  const v = reg.byName.get(varName)
  if (!v) return

  const rgba = parseOklch(oklch)
  if (alphaOverride !== undefined) {
    rgba.a = alphaOverride
  }
  const figmaRgba: RGBA = { r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a }

  const twId = reg.twLookup.get(rgbaKey(figmaRgba))
  if (twId && alphaOverride === undefined) {
    // Use Tailwind variable alias when an exact match exists (and no alpha override)
    v.setValueForMode(targetModeId, { type: "VARIABLE_ALIAS", id: twId })
  } else {
    v.setValueForMode(targetModeId, figmaRgba)
  }
}

const COLOR_TOKENS = [
  "background", "foreground",
  "card", "card-foreground",
  "popover", "popover-foreground",
  "primary", "primary-foreground",
  "secondary", "secondary-foreground",
  "muted", "muted-foreground",
  "accent", "accent-foreground",
  "destructive", "destructive-foreground",
  "border", "input", "ring",
  "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
  "sidebar", "sidebar-foreground",
  "sidebar-primary", "sidebar-primary-foreground",
  "sidebar-accent", "sidebar-accent-foreground",
  "sidebar-border", "sidebar-ring",
] as const

const PRIMARY_ACCENT_TOKENS = [
  "primary", "primary-foreground",
  "accent", "accent-foreground",
  "ring",
  "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
  "sidebar-primary", "sidebar-primary-foreground",
  "sidebar-accent", "sidebar-accent-foreground",
  "sidebar-ring",
] as const

async function applyBaseColor(reg: Registry, baseColor: string, targetModeId: string) {
  const theme = getTheme(baseColor)
  if (!theme) return
  for (const token of COLOR_TOKENS) {
    const light = (theme.cssVars.light as Record<string, string>)[token]
    const dark  = (theme.cssVars.dark as Record<string, string>)[token]
    applyColorVar(reg, `colors/${token}-light`, light, targetModeId)
    applyColorVar(reg, `colors/${token}-dark`,  dark,  targetModeId)
  }
}

async function applyTheme(reg: Registry, theme: string, baseColor: string, targetModeId: string) {
  if (theme === baseColor) return
  const themeData = getTheme(theme)
  if (!themeData) return
  for (const token of PRIMARY_ACCENT_TOKENS) {
    const light = (themeData.cssVars.light as Record<string, string>)[token]
    const dark  = (themeData.cssVars.dark  as Record<string, string>)[token]
    if (light) applyColorVar(reg, `colors/${token}-light`, light, targetModeId)
    if (dark)  applyColorVar(reg, `colors/${token}-dark`,  dark,  targetModeId)
  }
}

async function applyChartColor(reg: Registry, chartColor: string, baseColor: string, targetModeId: string) {
  if (chartColor === baseColor) return
  const chartTheme = getTheme(chartColor)
  if (!chartTheme) return
  for (const token of ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const) {
    const light = (chartTheme.cssVars.light as Record<string, string>)[token]
    const dark  = (chartTheme.cssVars.dark  as Record<string, string>)[token]
    if (light) applyColorVar(reg, `colors/${token}-light`, light, targetModeId)
    if (dark)  applyColorVar(reg, `colors/${token}-dark`,  dark,  targetModeId)
  }
}

// ─── Menu Color ───────────────────────────────────────────────────────────────

async function applyMenuColor(reg: Registry, menuColor: string, baseColor: string, theme: string, targetModeId: string) {
  const themeData = getTheme(theme) ?? getTheme(baseColor)
  if (!themeData) return

  const lightPopover     = (themeData.cssVars.light as Record<string, string>)["popover"]
  const darkPopover      = (themeData.cssVars.dark  as Record<string, string>)["popover"]
  const lightPopoverFg   = (themeData.cssVars.light as Record<string, string>)["popover-foreground"]
  const darkPopoverFg    = (themeData.cssVars.dark  as Record<string, string>)["popover-foreground"]

  const isInverted    = menuColor === "inverted" || menuColor === "inverted-translucent"
  const isTranslucent = menuColor === "default-translucent" || menuColor === "inverted-translucent"
  const alpha = isTranslucent ? 0.92 : undefined

  if (isInverted) {
    // Swap: light mode gets dark values, dark mode gets light values
    applyColorVar(reg, "colors/popover-light",            darkPopover,    targetModeId, alpha)
    applyColorVar(reg, "colors/popover-dark",             lightPopover,   targetModeId, alpha)
    applyColorVar(reg, "colors/popover-foreground-light", darkPopoverFg,  targetModeId)
    applyColorVar(reg, "colors/popover-foreground-dark",  lightPopoverFg, targetModeId)
  } else {
    applyColorVar(reg, "colors/popover-light",            lightPopover,   targetModeId, alpha)
    applyColorVar(reg, "colors/popover-dark",             darkPopover,    targetModeId, alpha)
    applyColorVar(reg, "colors/popover-foreground-light", lightPopoverFg, targetModeId)
    applyColorVar(reg, "colors/popover-foreground-dark",  darkPopoverFg,  targetModeId)
  }
}

// ─── Menu Accent ──────────────────────────────────────────────────────────────

async function applyMenuAccent(reg: Registry, menuAccent: string, baseColor: string, theme: string, targetModeId: string) {
  const themeData = getTheme(theme) ?? getTheme(baseColor)
  if (!themeData) return

  if (menuAccent === "bold") {
    // Use primary color for sidebar accent (bold highlighting)
    const lightPrimary    = (themeData.cssVars.light as Record<string, string>)["primary"]
    const darkPrimary     = (themeData.cssVars.dark  as Record<string, string>)["primary"]
    const lightPrimaryFg  = (themeData.cssVars.light as Record<string, string>)["primary-foreground"]
    const darkPrimaryFg   = (themeData.cssVars.dark  as Record<string, string>)["primary-foreground"]
    applyColorVar(reg, "colors/sidebar-accent-light",            lightPrimary,   targetModeId)
    applyColorVar(reg, "colors/sidebar-accent-dark",             darkPrimary,    targetModeId)
    applyColorVar(reg, "colors/sidebar-accent-foreground-light", lightPrimaryFg, targetModeId)
    applyColorVar(reg, "colors/sidebar-accent-foreground-dark",  darkPrimaryFg,  targetModeId)
  }
  // "subtle": leave sidebar-accent as set by applyBaseColor (no change needed)
}

// ─── Font Apply ───────────────────────────────────────────────────────────────

async function applyFont(reg: Registry, font: string, fontHeading: string, targetModeId: string) {
  const bodyFont    = getFont(font)
  const headingFont = fontHeading === "inherit" ? bodyFont : (getFont(fontHeading) ?? bodyFont)

  // Use title (e.g. "Noto Sans") — Figma font names don't use "Variable" suffix
  if (bodyFont) {
    const fontSansVar = reg.byName.get("font/font-sans")
    if (fontSansVar) fontSansVar.setValueForMode(targetModeId, bodyFont.title)
  }

  // Update heading font variables in Collection 4 (Custom) if it exists
  const coll = reg.customCollection
  if (coll && headingFont) {
    const allVars = await figma.variables.getLocalVariablesAsync()
    const fontVars = allVars.filter(
      (v) => v.variableCollectionId === coll.id && v.name.toLowerCase().includes("font-family")
    )
    for (const v of fontVars) {
      const isHeading = v.name.toLowerCase().includes("heading")
      const target = isHeading ? headingFont : bodyFont
      if (!target) continue
      for (const mode of coll.modes) {
        v.setValueForMode(mode.modeId, target.title)
      }
    }
  }
}

// ─── Icon Library Apply ───────────────────────────────────────────────────────

const ICON_LIBRARY_FIGMA_NAMES: Record<string, string[]> = {
  lucide:     ["Lucide Icons"],
  tabler:     ["Tabler Icons"],
  hugeicons:  ["HugeIcons"],
  phosphor:   ["Phosphor Icons"],
  remix:      ["Remix Icon"],
}

async function applyIconLibrary(reg: Registry, library: string) {
  const coll = reg.iconCollection
  if (!coll) return
  const targetNames = ICON_LIBRARY_FIGMA_NAMES[library] ?? [library]
  const defaultMode = coll.modes[0]
  const allVars = await figma.variables.getLocalVariablesAsync()
  const iconVars = allVars.filter(
    (v) => v.variableCollectionId === coll.id && v.resolvedType === "BOOLEAN"
  )
  for (const v of iconVars) {
    const isTarget = targetNames.some((n) => v.name.includes(n))
    v.setValueForMode(defaultMode.modeId, isTarget)
  }
}

// ─── Radius Apply ─────────────────────────────────────────────────────────────

async function applyRadius(reg: Registry, radius: string, baseColor: string, targetModeId: string) {
  const coll = reg.themeCollection

  const remStr  = getRadiusValue(radius, baseColor)  // e.g. "0.625rem" or "0"
  const basePx  = remStr === "0" ? 0 : parseFloat(remStr) * 16

  const radiusMap: Record<string, number> = {
    "radius/xs":  Math.max(0, basePx - 8),
    "radius/sm":  Math.max(0, basePx - 4),
    "radius/md":  Math.max(0, basePx - 2),
    "radius/lg":  basePx,
    "radius/xl":  basePx + 4,
    "radius/2xl": basePx + 8,
    "radius/3xl": basePx + 12,
    "radius/4xl": basePx + 16,
  }

  for (const [name, value] of Object.entries(radiusMap)) {
    const v = reg.byName.get(name)
    if (v) v.setValueForMode(targetModeId, value)
  }
}

// ─── Style Apply (component variant swap) ────────────────────────────────────

async function applyStyle(style: string) {
  const originalPage = figma.currentPage
  for (const page of figma.root.children) {
    await figma.setCurrentPageAsync(page)
    const instances = page.findAllWithCriteria({ types: ["INSTANCE"] }) as InstanceNode[]
    for (const instance of instances) {
      const mainComp = instance.mainComponent
      if (!mainComp) continue
      const parent = mainComp.parent
      if (!parent || parent.type !== "COMPONENT_SET") continue
      const compSet = parent as ComponentSetNode
      const styleKey = Object.keys(compSet.variantGroupProperties ?? {}).find(
        (k) => k.toLowerCase() === "style"
      )
      if (!styleKey) continue

      // Skip if already on the correct style
      const currentStyle = (mainComp.variantProperties ?? {})[styleKey]
      if (currentStyle?.toLowerCase() === style.toLowerCase()) continue

      const targetVariant = (compSet.children as ComponentNode[]).find((child) => {
        const props = child.variantProperties ?? {}
        const k = Object.keys(props).find((k) => k.toLowerCase() === "style")
        return k ? props[k].toLowerCase() === style.toLowerCase() : false
      })
      if (!targetVariant) continue
      try {
        instance.swapComponent(targetVariant)
      } catch {
        // not swappable — skip
      }
    }
  }
  // Restore original page
  await figma.setCurrentPageAsync(originalPage)
}

// ─── Mode Management ──────────────────────────────────────────────────────────

function getModeName(config: DesignSystemConfig): string {
  const parts = [config.style, config.baseColor]
  if (config.theme !== config.baseColor) parts.push(config.theme)
  if (config.chartColor !== config.baseColor && config.chartColor !== config.theme) parts.push(config.chartColor)
  parts.push(config.iconLibrary)
  return parts.join(" / ")
}

function getOrCreateMode(coll: VariableCollection, name: string): string {
  const existing = coll.modes.find((m) => m.name === name)
  if (existing) return existing.modeId
  try {
    coll.addMode(name)
    const created = coll.modes.find((m) => m.name === name)
    if (created) return created.modeId
  } catch {
    // Figma free plan: can't add modes — fall back to the first mode
  }
  return coll.modes[0].modeId
}

// ─── Apply Config ─────────────────────────────────────────────────────────────

async function applyConfig(config: DesignSystemConfig) {
  const send = (message: string) =>
    figma.ui.postMessage({ type: "progress", message } as PluginMessage)

  send("Building registry...")
  const reg = await buildRegistry()

  const modeName    = getModeName(config)
  const targetModeId = getOrCreateMode(reg.themeCollection, modeName)

  send("Applying base color...")
  await applyBaseColor(reg, config.baseColor, targetModeId)

  send("Applying theme...")
  await applyTheme(reg, config.theme, config.baseColor, targetModeId)

  send("Applying chart colors...")
  await applyChartColor(reg, config.chartColor, config.baseColor, targetModeId)

  send("Applying menu color...")
  await applyMenuColor(reg, config.menuColor, config.baseColor, config.theme, targetModeId)

  send("Applying menu accent...")
  await applyMenuAccent(reg, config.menuAccent, config.baseColor, config.theme, targetModeId)

  send("Applying radius...")
  await applyRadius(reg, config.radius, config.baseColor, targetModeId)

  send("Applying fonts...")
  await applyFont(reg, config.font, config.fontHeading, targetModeId)

  send("Applying icon library...")
  await applyIconLibrary(reg, config.iconLibrary)

  const lastAppliedStyle = figma.root.getPluginData("shadcn-applied-style")
  if (config.style !== lastAppliedStyle) {
    send("Applying style variants...")
    await applyStyle(config.style)
    figma.root.setPluginData("shadcn-applied-style", config.style)
  }

  figma.ui.postMessage({
    type: "done",
    success: true,
    message: `Applied: ${modeName}`,
  } as PluginMessage)
}

// ─── Read Current State ───────────────────────────────────────────────────────

async function readCurrentConfig(): Promise<DesignSystemConfig> {
  const config = { ...DEFAULT_CONFIG }
  try {
    const allVars = await figma.variables.getLocalVariablesAsync()

    // Read active icon library from Collection 5
    const iconVars = allVars.filter(
      (v) => v.variableCollectionId === COLL_ICONS && v.resolvedType === "BOOLEAN"
    )
    for (const v of iconVars) {
      const val = v.valuesByMode["21003:0"]
      if (val === true) {
        for (const [key, names] of Object.entries(ICON_LIBRARY_FIGMA_NAMES)) {
          if (names.some((n) => v.name.includes(n))) {
            config.iconLibrary = key
            break
          }
        }
      }
    }
  } catch {
    // non-critical
  }
  return config
}

// ─── Message Handler ──────────────────────────────────────────────────────────

figma.ui.onmessage = async (msg: UIMessage) => {
  if (msg.type === "apply") {
    try {
      await applyConfig(msg.config)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      figma.ui.postMessage({ type: "done", success: false, message } as PluginMessage)
    }
  } else if (msg.type === "readState") {
    const config = await readCurrentConfig()
    figma.ui.postMessage({ type: "init", config } as PluginMessage)
  } else if (msg.type === "resize") {
    figma.ui.resize(msg.width, msg.height)
  }
}

// Initialize
;(async () => {
  const config = await readCurrentConfig()
  figma.ui.postMessage({ type: "init", config } as PluginMessage)
})()
