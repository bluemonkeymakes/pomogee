# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # install deps (uses pnpm, not npm)
pnpm dev              # web-only dev server (faster, no Tauri shell)
pnpm tauri dev        # full desktop app with hot reload
pnpm build            # tsc + vite build (web bundle only)
pnpm tauri build      # full desktop build → src-tauri/target/release/bundle/
```

There are no tests. TypeScript compilation (`tsc --noEmit`) is the primary correctness check.

## Architecture

### App structure

`App.tsx` is a two-tab shell (Timer / Calendar) wrapping `TimerView` and `CalendarView`. All state lives in a single Zustand store (`src/lib/store.ts`) persisted to localStorage under the key `pomoge:timer`. Only `settings` and `sessions` are persisted — runtime fields (`phase`, `runState`, `endsAt`, etc.) always reset to idle on reload.

### State model (`src/lib/types.ts` + `src/lib/store.ts`)

- `Phase`: `idle | work | shortBreak | longBreak` — what the timer is currently counting
- `RunState`: `idle | running | paused`
- `Session`: a completed (or interrupted) time block. Completed work sessions carry a `mode` (`continuous | break | gap`) and `streakIndex` (0-based count of completed work sessions that day).
- `SessionMode` is computed at session-end: **gap** if idle >10 min before starting (`GAP_MS`), **break** if preceded by a timed break, **continuous** otherwise.

### Shape engine (`src/lib/shapes.ts`)

Every completed work session maps to one SVG path determined by four independent dimensions:

| Input | Effect |
|---|---|
| `position` (0–19, capped at `COMPLEXITY_CAP=7`) | Shape complexity — polygon sides / star preset |
| `mode` | Shape family — `continuous→polygon`, `break→circle`, `gap→star` |
| day-of-year × 7 mod 3 | `variant` (0–2) — slight rotation or 0.88× scale |
| `startedAt` hour | Radius scale — morning 0.55×, midday 0.72×, evening 0.88×, night 1.0× |

The topmost layer also gets a center inset (`dot/triangle/star/ring`) keyed to time-of-day.

`shapeFor()` is the main entry point. `shapeFromFamily()` bypasses mode routing for previews.

### Geometry rendering (`src/components/geometry.tsx`)

`<Geometry>` renders the full day's mandala. It takes `completedLayers` + optional `activeLayer` with a `progress` 0–1. The active layer strokes in via `strokeDashoffset` using `pathLength={1000}` for uniform animation regardless of geometric complexity.

**Star exclusivity rule**: at most one star-family shape per time-of-day radius bucket (morning/midday/evening/night). A second gap in the same bucket downgrades to a polygon. This is implemented in `resolveRenderModes()`.

`<GlyphSummary>` is the compact calendar-cell variant of the same renderer.

### CSS tokens

Three geometry-specific CSS custom properties live in `index.css` alongside the standard shadcn tokens:
- `--glyph` — past-layer stroke
- `--glyph-broken` — interrupted-session style
- `--glyph-active` — accent color for the in-progress layer (amber in dark mode)

### Landing page (`docs/index.html`)

Completely standalone static HTML — no build step, no Vite. The shape-drawing JS is a hand-ported copy of the shape engine. Deploy by serving the `docs/` directory. Screenshot assets (`pomogee-shots-*.png`) live alongside `index.html`.

### ShowcaseView (`src/components/showcase-view.tsx`)

An internal design tool for experimenting with shape-family assignment rules. Not wired into the main app nav — render it directly in `App.tsx` if needed. Contains synthetic session groups and a `EXPERIMENTS` array for comparing different mode→family mappings.
