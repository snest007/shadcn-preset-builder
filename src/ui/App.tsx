import React, { useEffect, useRef, useState } from "react"
import {
  STYLES,
  BASE_COLOR_NAMES,
  THEMES,
  FONTS,
  RADII,
  MENU_COLORS,
  MENU_ACCENTS,
  ICON_LIBRARIES,
  PRESETS,
  DEFAULT_CONFIG,
  getTheme,
} from "@shared/theme-data"
import type { DesignSystemConfig, PluginMessage, UIMessage } from "@shared/types"
import { parseOklch } from "@shared/color-utils"
import { encodePreset, decodePreset } from "@shared/preset-utils"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toRgbCss(oklch: string): string {
  const { r, g, b, a } = parseOklch(oklch)
  const r255 = Math.round(r * 255)
  const g255 = Math.round(g * 255)
  const b255 = Math.round(b * 255)
  return a < 1 ? `rgba(${r255},${g255},${b255},${a})` : `rgb(${r255},${g255},${b255})`
}

function getThemePreviewColor(name: string): string {
  const theme = getTheme(name)
  if (!theme) return "#888"
  const primary = theme.cssVars.light.primary
  if (!primary) return "#888"
  try {
    return toRgbCss(primary)
  } catch {
    return "#888"
  }
}

// ─── ConfigRow ────────────────────────────────────────────────────────────────

interface ConfigRowProps {
  label: string
  value: string
  options: { name: string; label?: string; color?: string }[]
  onChange: (v: string) => void
  renderSwatch?: (name: string) => React.ReactNode
}

function ConfigRow({ label, value, options, onChange, renderSwatch }: ConfigRowProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.name === value)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} style={{ position: "relative", borderBottom: "1px solid var(--border)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          padding: "10px 14px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text)",
          gap: 8,
        }}
      >
        <span style={{ flex: 1, textAlign: "left" }}>
          <span style={{ color: "var(--text-muted)", display: "block", fontSize: 10, marginBottom: 1 }}>
            {label}
          </span>
          <span style={{ fontWeight: 600, fontSize: 12 }}>{current?.label ?? value}</span>
        </span>
        {renderSwatch && renderSwatch(value)}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 100,
            background: "#1a1a1a",
            border: "1px solid var(--border)",
            borderRadius: 6,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.name}
              onClick={() => {
                onChange(opt.name)
                setOpen(false)
              }}
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                padding: "8px 14px",
                background: opt.name === value ? "#2a2a2a" : "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text)",
                gap: 8,
                textAlign: "left",
              }}
            >
              {renderSwatch && renderSwatch(opt.name)}
              <span style={{ flex: 1, fontSize: 12 }}>{opt.label ?? opt.name}</span>
              {opt.name === value && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ColorSwatch ──────────────────────────────────────────────────────────────

function ColorSwatch({ name }: { name: string }) {
  const color = getThemePreviewColor(name)
  return (
    <div
      style={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: color,
        border: "1px solid rgba(255,255,255,0.15)",
        flexShrink: 0,
      }}
    />
  )
}

// ─── RadiusSwatch ─────────────────────────────────────────────────────────────

function RadiusSwatch({ name }: { name: string }) {
  const radiusMap: Record<string, number> = {
    none: 0,
    small: 2,
    default: 4,
    medium: 6,
    large: 8,
  }
  const r = radiusMap[name] ?? 4
  return (
    <div
      style={{
        width: 14,
        height: 14,
        border: "1.5px solid rgba(255,255,255,0.4)",
        borderRadius: r,
        flexShrink: 0,
      }}
    />
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [config, setConfig] = useState<DesignSystemConfig>({ ...DEFAULT_CONFIG })
  const [status, setStatus] = useState<string>("")
  const [applying, setApplying] = useState(false)
  const [presetCode, setPresetCode] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Fit window to content height on mount
    if (rootRef.current) {
      const h = rootRef.current.offsetHeight
      parent.postMessage({ pluginMessage: { type: "resize", width: 320, height: h } }, "*")
    }

    window.onmessage = (e: MessageEvent) => {
      const msg = e.data.pluginMessage as PluginMessage
      if (!msg) return

      if (msg.type === "init") {
        setConfig(msg.config)
      } else if (msg.type === "progress") {
        setStatus(msg.message ?? "")
      } else if (msg.type === "done") {
        setApplying(false)
        setStatus(msg.message ?? (msg.success ? "Done!" : "Error"))
        setTimeout(() => setStatus(""), 3000)
      }
    }

    postToPlugin({ type: "readState" })
  }, [])

  function postToPlugin(msg: UIMessage) {
    parent.postMessage({ pluginMessage: msg }, "*")
  }

  function update(key: keyof DesignSystemConfig, val: string) {
    setConfig((prev) => ({ ...prev, [key]: val }))
  }

  function handleApply() {
    setApplying(true)
    setStatus("Applying...")
    postToPlugin({ type: "apply", config })
  }

  function handleOpenPreset() {
    const raw = presetCode.replace(/^--preset\s+/, "").trim()
    const parsed = decodePreset(raw)
    if (parsed) {
      setConfig((prev) => ({ ...prev, ...parsed }))
      setPresetCode("")
      setStatus("Preset loaded!")
    } else {
      setStatus("Invalid preset code")
    }
    setTimeout(() => setStatus(""), 2000)
  }

  function handleShuffle() {
    const idx = Math.floor(Math.random() * PRESETS.length)
    const preset = PRESETS[idx]
    // PRESETS already contain all DesignSystemConfig fields directly
    const { name: _n, title: _t, description: _d, ...configFields } = preset as typeof preset & { name: string; title: string; description: string }
    setConfig((prev) => ({ ...prev, ...configFields }))
  }

  function generateCode(): string {
    return `--preset ${encodePreset(config)}`
  }

  // Theme options: base colors + accent themes
  const baseColorOptions = BASE_COLOR_NAMES.map((name) => {
    const theme = getTheme(name)
    return { name, label: theme?.title ?? name }
  })
  const themeOptions = THEMES.map((t) => ({ name: t.name, label: t.title }))
  const fontOptions = [...FONTS.map((f) => ({ name: f.name, label: f.title }))]
  const headingFontOptions = [
    { name: "inherit", label: "Inherit (same as body)" },
    ...FONTS.map((f) => ({ name: f.name, label: f.title })),
  ]
  const iconOptions = ICON_LIBRARIES.map((l) => ({ name: l.name, label: l.label }))
  const radiusOptions = RADII.map((r) => ({ name: r.name, label: r.label }))
  const menuOptions = MENU_COLORS.map((m) => ({ name: m.value, label: m.label }))
  const menuAccentOptions = MENU_ACCENTS.map((m) => ({ name: m.value, label: m.label }))
  const styleOptions = STYLES.map((s) => ({ name: s.name, label: s.title }))

  return (
    <div ref={rootRef} style={{ background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* Config rows */}
      <div style={{ flex: 1 }}>
        <ConfigRow
          label="Style"
          value={config.style}
          options={styleOptions}
          onChange={(v) => update("style", v)}
        />
        <ConfigRow
          label="Base Color"
          value={config.baseColor}
          options={baseColorOptions}
          onChange={(v) => update("baseColor", v)}
          renderSwatch={(name) => <ColorSwatch name={name} />}
        />
        <ConfigRow
          label="Theme"
          value={config.theme}
          options={themeOptions}
          onChange={(v) => update("theme", v)}
          renderSwatch={(name) => <ColorSwatch name={name} />}
        />
        <ConfigRow
          label="Chart Color"
          value={config.chartColor}
          options={themeOptions}
          onChange={(v) => update("chartColor", v)}
          renderSwatch={(name) => <ColorSwatch name={name} />}
        />
        <ConfigRow
          label="Heading Font"
          value={config.fontHeading}
          options={headingFontOptions}
          onChange={(v) => update("fontHeading", v)}
        />
        <ConfigRow
          label="Body Font"
          value={config.font}
          options={fontOptions}
          onChange={(v) => update("font", v)}
        />
        <ConfigRow
          label="Icon Library"
          value={config.iconLibrary}
          options={iconOptions}
          onChange={(v) => update("iconLibrary", v)}
        />
        <ConfigRow
          label="Radius"
          value={config.radius}
          options={radiusOptions}
          onChange={(v) => update("radius", v)}
          renderSwatch={(name) => <RadiusSwatch name={name} />}
        />
        <ConfigRow
          label="Menu"
          value={config.menuColor}
          options={menuOptions}
          onChange={(v) => update("menuColor", v)}
        />
        <ConfigRow
          label="Menu Accent"
          value={config.menuAccent}
          options={menuAccentOptions}
          onChange={(v) => update("menuAccent", v)}
        />
      </div>

      {/* Preset Bar */}
      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* Current config code — read-only with copy button */}
        <div style={{ display: "flex", gap: 6 }}>
          <input
            readOnly
            value={generateCode()}
            style={{
              flex: 1,
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text-muted)",
              padding: "5px 8px",
              fontSize: 10,
              fontFamily: "monospace",
              outline: "none",
              cursor: "default",
            }}
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(generateCode())
              setStatus("Copied!")
              setTimeout(() => setStatus(""), 1500)
            }}
            title="Copy preset code"
            style={{
              padding: "5px 8px",
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 10,
              flexShrink: 0,
            }}
          >
            Copy
          </button>
        </div>
        {/* Paste input for loading a preset */}
        <div style={{ display: "flex", gap: 6 }}>
          <a
            href="https://ui.shadcn.com/create"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => { e.preventDefault(); window.open("https://ui.shadcn.com/create") }}
            title="Open shadcn/ui create"
            style={{
              display: "flex",
              alignItems: "center",
              padding: "5px 7px",
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text-muted)",
              flexShrink: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
          <input
            value={presetCode}
            onChange={(e) => setPresetCode(e.target.value)}
            placeholder="--preset ..."
            style={{
              flex: 1,
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text)",
              padding: "5px 8px",
              fontSize: 10,
              fontFamily: "monospace",
              outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={handleOpenPreset}
            style={{
              flex: 1,
              padding: "6px 10px",
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text)",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            Load Preset
          </button>
          <button
            onClick={handleShuffle}
            style={{
              flex: 1,
              padding: "6px 10px",
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text)",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            Shuffle
          </button>
        </div>
      </div>

      {/* Status */}
      {status && (
        <div
          style={{
            padding: "6px 14px",
            fontSize: 11,
            color: status.toLowerCase().includes("error") ? "#f87171" : "#4ade80",
            borderTop: "1px solid var(--border)",
          }}
        >
          {status}
        </div>
      )}

      {/* Apply Button */}
      <div style={{ padding: "10px 14px", borderTop: status ? "none" : "1px solid var(--border)" }}>
        <button
          onClick={handleApply}
          disabled={applying}
          style={{
            width: "100%",
            padding: "10px",
            background: applying ? "#1d4ed8" : "#2563eb",
            border: "none",
            borderRadius: 6,
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: applying ? "not-allowed" : "pointer",
            opacity: applying ? 0.8 : 1,
            transition: "background 0.15s",
          }}
        >
          {applying ? "Applying..." : "Apply to File"}
        </button>
      </div>
    </div>
  )
}
