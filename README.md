# Shadcn Preset Builder

Shadcn Preset Builder is a Figma plugin for building and applying shadcn-style design system presets directly inside a Figma file.

It combines a React-based plugin UI with a Figma plugin runtime that can:

- apply color tokens from predefined OKLCH theme sets
- switch component style variants across the file
- update radii, fonts, menu appearance, and icon library flags
- import and export shadcn-compatible preset codes

## What This Project Is

This repository is not a traditional web app. It is a Figma plugin made of two parts:

- `src/plugin`: the Figma runtime that reads and writes variables, plugin data, and component instances
- `src/ui`: the React UI rendered inside the plugin panel

The build outputs are:

- `dist/code.js`: plugin main thread bundle
- `dist/index.html`: inlined UI bundle used by the Figma manifest

## Tech Stack

- TypeScript
- React 18
- Vite
- esbuild
- Figma Plugin API

## Project Structure

```text
src/
  plugin/        Figma runtime logic
  shared/        theme data, preset encoding, shared types, color utilities
  ui/            React-based plugin interface
manifest.json    Figma plugin manifest
vite.config.ts   UI bundling config
```

## Local Development

Install dependencies:

```bash
npm install
```

Run the plugin and UI in watch mode:

```bash
npm run dev
```

This starts:

- `npm run dev:plugin` to watch and rebuild `dist/code.js`
- `npm run dev:ui` to watch and rebuild `dist/index.html`

Build once for production:

```bash
npm run build
```

## Loading In Figma

1. Run `npm run build` at least once.
2. Open Figma Desktop.
3. Go to `Plugins > Development > Import plugin from manifest...`
4. Select `manifest.json` from this repository.
5. Run the plugin from the Development plugins list.

## Current Capabilities

- Choose a style preset such as `nova`, `vega`, `maia`, `lyra`, `mira`, or `luma`
- Apply base colors and accent themes
- Override chart colors independently
- Change body and heading font variables
- Update radius token scales
- Toggle menu color behavior and menu accent intensity
- Switch icon-library booleans for supported icon systems
- Encode and decode `--preset` values compatible with shadcn preset codes

## Important Limitation

This plugin currently targets a specific Figma file structure and expects certain local variable collections and variable names to already exist.

In particular, the plugin runtime relies on known collection IDs and token names. If you import it into a different Figma file without the same variables and collections, parts of the plugin may not work as expected.

If you want to make the plugin reusable across multiple files or teams, the main area to improve is the variable discovery and configuration layer in `src/plugin/index.ts`.

## Scripts

- `npm run build`: build both plugin runtime and UI
- `npm run build:plugin`: build the Figma runtime bundle
- `npm run build:ui`: build the plugin UI bundle
- `npm run dev`: watch both parts during development
- `npm run dev:plugin`: watch the plugin runtime
- `npm run dev:ui`: watch the UI bundle

## Repository Notes

- `node_modules` and `dist` are ignored from git
- `package-lock.json` is committed for reproducible installs
- The project is currently marked `private` in `package.json` because it is not intended for npm publishing
