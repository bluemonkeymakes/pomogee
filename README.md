# Pomoge

A Pomodoro timer desktop app built with Tauri, React, and TypeScript.

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs/) (stable toolchain)
- Tauri system dependencies — see [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS

## Setup

```bash
npm install
```

## Development

**Web only** (faster iteration, no desktop shell):
```bash
npm run dev
```

**Full desktop app:**
```bash
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

Output is in `src-tauri/target/release/bundle/`.

## Stack

- [Tauri v2](https://tauri.app/) — desktop shell
- React 19 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- Zustand (state management)
