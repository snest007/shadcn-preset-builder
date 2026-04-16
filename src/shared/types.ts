export type ThemeVarsLight = {
  background?: string
  foreground?: string
  card?: string
  "card-foreground"?: string
  popover?: string
  "popover-foreground"?: string
  primary?: string
  "primary-foreground"?: string
  secondary?: string
  "secondary-foreground"?: string
  muted?: string
  "muted-foreground"?: string
  accent?: string
  "accent-foreground"?: string
  destructive?: string
  "destructive-foreground"?: string
  border?: string
  input?: string
  ring?: string
  radius?: string
  "chart-1"?: string
  "chart-2"?: string
  "chart-3"?: string
  "chart-4"?: string
  "chart-5"?: string
  sidebar?: string
  "sidebar-foreground"?: string
  "sidebar-primary"?: string
  "sidebar-primary-foreground"?: string
  "sidebar-accent"?: string
  "sidebar-accent-foreground"?: string
  "sidebar-border"?: string
  "sidebar-ring"?: string
}

export type ThemeDefinition = {
  name: string
  title: string
  cssVars: {
    light: ThemeVarsLight
    dark: ThemeVarsLight
  }
}

export type DesignSystemConfig = {
  style: string
  baseColor: string
  theme: string
  chartColor: string
  font: string
  fontHeading: string
  iconLibrary: string
  radius: string
  menuColor: string
  menuAccent: string
}

export type FontDefinition = {
  name: string
  title: string
  family: string
}

export type PluginMessage =
  | { type: "init"; config: DesignSystemConfig }
  | { type: "done"; success: boolean; message?: string }
  | { type: "progress"; message: string }

export type UIMessage =
  | { type: "apply"; config: DesignSystemConfig }
  | { type: "readState" }
  | { type: "resize"; width: number; height: number }
