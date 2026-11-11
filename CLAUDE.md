# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Pomoge(e) — a Pomodoro timer desktop app whose completed work sessions render as a generative SVG mandala for the day.

## Tech stack

Tauri v2 (Rust desktop shell) + React 19 + TypeScript + Vite. Tailwind CSS + shadcn/ui for UI, Zustand for state (persisted to localStorage). Package manager is **pnpm** (`pnpm-lock.yaml`). Frontend lives in `src/`, the Rust/Tauri shell in `src-tauri/`.

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

`App.tsx` is a three-tab shell (Timer / Bell / Calendar) wrapping `TimerView`, `BellView` and `CalendarView`. The store clock (`tick`) is driven from `App.tsx`, not from a view: inactive tab content unmounts, so a tick inside a tab stops the timer from completing while another tab shows. All state lives in a single Zustand store (`src/lib/store.ts`) persisted to localStorage under the key `pomoge:timer`. Only `settings` and `sessions` are persisted — runtime fields (`phase`, `runState`, `endsAt`, etc.) always reset to idle on reload.

### State model (`src/lib/types.ts` + `src/lib/store.ts`)

- `Phase`: `idle | work | shortBreak | longBreak` — what the timer is currently counting
- `RunState`: `idle | running | paused`
- `Session`: a completed (or interrupted) time block. Completed work sessions carry a `mode` (`continuous | break | gap`) and `streakIndex` (0-based count of completed work sessions that day).
- `SessionMode` is computed at session-end: **gap** if idle >10 min before starting (`GAP_MS`), **break** if preceded by a timed break, **continuous** otherwise.

### Bells (`src/lib/bell.ts` + `src/components/bell-view.tsx`)

`bell.ts` synthesizes bells from sine partials (no audio assets). A tone is one entry in `BELL_TONES`; `playBell(tone, volume)` rings it and never throws.

Playback path, each step forced by a measured WebKitGTK failure (do not "simplify" back):
- Tones are rendered **offline** (`OfflineAudioContext`) to a WAV clip and played through an `<audio>` element. A live `AudioContext` goes permanently silent in the desktop webview unless sound starts within a few hundredths of a second of its creation, while still reporting `running`.
- **Volume is baked into the samples**, never set via `audio.volume`: on Linux the webview applies it as the stream volume, which WirePlumber saves for the whole `Music` role and restores on the next stream.
- Playing elements are held in a set until `ended`, or they get garbage-collected mid-ring.

Two uses:

- **Completion bell**: `finishCurrent()` rings `settings.bellTone` when `settings.bellOnComplete` is on.
- **Interval bell (Bell tab)**: `startBell()` / `stopBell()` plus the `bell*` runtime fields. It runs independently of the timer, rings every `settings.bellIntervalMinutes`, and is never persisted or shown on the Calendar. `BellMandala` draws one layer per ring, eight to a round, cycling circle → polygon → star families via `shapeFromFamily()`. It is separate from the day's work mandala on purpose.

### Shape engine (`src/lib/shapes.ts`)

Every completed work session maps to one SVG path determined by four independent dimensions:

| Input | Effect |
|---|---|
| `position` (0–`MAX_SHAPE_INDEX`=19, capped at `COMPLEXITY_CAP`=7) | Shape complexity — polygon sides / star preset |
| `mode` | Shape family — `continuous→polygon`, `break→circle/rings`, `gap→star` |
| day-of-year × 7 mod 3 | `variant` (0–2) — rotation offset or scale |
| `startedAt` hour | Radius scale — morning 0.55×, midday 0.72×, evening 0.88×, night 1.0× |

**Variant detail** — all sessions on the same day share the same variant (deterministic from day-of-year). Variant 0: baseline (no change). Variant 1: fixed +15° rotation (`π/12`) applied to polygons and stars — the angle is intentionally fixed, not `π/sides`, so all shapes in the mandala rotate by the same amount and stay visually coherent. Variant 2: 0.88× scale reduction.

**Overflow behavior** — positions beyond `COMPLEXITY_CAP` (7) stop increasing polygon sides or star complexity. Break shapes continue to differentiate: each overflow position adds one more concentric ring (`rings = p + overflow`), keeping them visually distinct indefinitely.

**Shape families:**
- `continuous` (polygon): triangle at position 0, +1 side per position up to decagon at position 7.
- `gap` (star polygon): 20 unicursal presets in `GAP_STAR_PRESETS` — pairs alternate between sparser and denser stars at the same `n` for variety (e.g. {7/2} then {7/3}).
- `break` (circles): position 0 = 1 ring, position p = p rings, all concentric, shrinking inward. Overflow adds further rings beyond 7.

**Center inset** — the topmost layer gets a small motif at center keyed to time-of-day bucket: morning→dot, midday→triangle, evening→star (pentagram), night→ring. Radius is 12% of the layer R.

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
