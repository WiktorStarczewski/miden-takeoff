# Miden Takeoff

An AI-powered browser IDE for building smart contracts and dApps on the [Miden](https://miden.xyz) blockchain. Generate Rust smart contracts through natural language, compile them to WASM, deploy to testnet, and build interactive dApps — all from a single interface.

![License](https://img.shields.io/badge/license-MIT-blue)
![Miden SDK](https://img.shields.io/badge/miden--sdk-0.14.10-green)
![TypeScript](https://img.shields.io/badge/typescript-strict-blue)

## What is this?

Miden Takeoff is a Remix IDE-style playground specifically designed for the Miden rollup. It combines:

- **AI-Assisted Contract Development** — Chat with an AI assistant (Claude) that understands the Miden Rust SDK, generates contracts with `#[component]` macros, `StorageMap`/`Value` storage, and all the Miden-specific patterns.
- **In-Browser Compilation** — Contracts compile via Docker-sandboxed `cargo-miden` with the exact Miden compiler toolchain (`nightly-2025-12-10`). Compilation output streams in real-time, and errors appear as inline squiggles in the Monaco editor.
- **One-Click Deployment** — Deploy compiled contracts to Miden testnet directly from the browser. The deployment flow handles `AccountBuilder`, storage slot registration, and account creation.
- **Live dApp Preview** — Switch to dApp mode and the AI generates React components using `@miden-sdk/react` hooks. The preview runs inside the same `MidenProvider` — real WASM, real hooks, real testnet transactions.
- **Transaction Script Auto-Generation** — When you compile a contract, Takeoff automatically generates and compiles a Rust `#[tx_script]` for each public method. These pre-compiled transaction scripts enable the dApp to call contract methods without manual MASM authoring.

## Architecture

```
Browser (Vite + React)
├── Monaco Editor (Rust / TypeScript)
├── AI Chat (Claude API via Express backend)
├── Live Preview (Sucrase eval + real MidenProvider)
├── MidenFi Wallet Adapter (connect/sign)
└── @miden-sdk/miden-sdk (WASM client)

Express Backend (:3001)
├── /api/chat → Claude API (SSE streaming)
└── /api/compile → Docker (cargo-miden)

Docker (compiler)
├── nightly-2025-12-10 toolchain
├── cargo-miden 0.5.1
├── miden 0.10.0 (protocol 0.13.3)
└── Persistent cargo cache volumes
```

## UI Layout

### Contracts Mode
```
┌──────────────────────────────────────────────────────────────────────┐
│  Miden Takeoff    [Contracts] [dApp]       testnet   Connect Wallet │
├────────────┬─────────────────────────────────┬───────────────────────┤
│ EXPLORER   │ lib.rs  ×  Cargo.toml  ×        │ ASSISTANT            │
│            │                                 │                      │
│ ▾ src/     │  #![no_std]                     │ You: Create a counter│
│   lib.rs   │  use miden::*;                  │ contract with inc/dec│
│ Cargo.toml │                                 │                      │
│            │  #[component]                   │ AI: Here's a counter │
│────────────│  struct Counter {               │ component...         │
│ CONTRACTS  │      count_map: StorageMap,     │                      │
│ counter    │  }                              │ [Apply to lib.rs]    │
│  ✓ compiled│                                 │ [Apply to Cargo.toml]│
│  [Deploy]  │                                 │                      │
├────────────┼─────────────────────────────────┤                      │
│ CONSOLE                                      │                      │
│ Compiling counter-contract v0.1.0...         │                      │
│ ✓ Build succeeded (5.72s)                    │                      │
│ ✓ TX script for increment_count              │                      │
├──────────────────────────────────────────────┴──────────────────────┤
│ ● Connected  │  Block: 1496855  │  Contracts mode                   │
└─────────────────────────────────────────────────────────────────────┘
```

### dApp Mode
```
┌──────────────────────────────────────────────────────────────────────┐
│  Miden Takeoff    [Contracts] [dApp]       testnet   0x5b3b...b145  │
├────────────┬────────────────┬────────────────┬───────────────────────┤
│ EXPLORER   │ App.tsx  ×     │  PREVIEW       │ ASSISTANT            │
│            │                │                │                      │
│ ▾ src/     │ import {       │  Counter dApp  │ You: Build a UI for  │
│   App.tsx  │   useMiden     │                │ the counter contract │
│            │ } from ...     │     42         │                      │
│────────────│                │                │ AI: Here's a React   │
│ CONTRACTS  │ export default │  [Increment]   │ app that reads and   │
│ (read-only)│ function App() │                │ increments...        │
│ counter    │   ...          │  ⚡ complete ✅ │                      │
│  0xd7d1... │                │                │ [Apply to App.tsx]   │
├────────────┼────────────────┴────────────────┤                      │
│ CONSOLE                                      │                      │
│ Storage slots: miden::component::...         │                      │
│ Post-increment value: 0x2b0000000...         │                      │
├──────────────────────────────────────────────┴──────────────────────┤
│ ● Connected  │  Block: 1496855  │  dApp mode                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Features

### Smart Contract Development
- **AI Code Generation** — Describe what you want in natural language; the AI generates Rust contracts using `miden 0.10.0` with `#[component]`, `StorageMap`, `felt!()` macros, and proper `no_std` patterns.
- **Monaco Editor** — Full-featured code editor with custom dark theme, Rust syntax highlighting, editor tabs, and dirty file indicators.
- **Inline Diagnostics** — Cargo compilation errors are parsed and displayed as red squiggles on the exact line in the editor.
- **Virtual Filesystem** — Files are managed in-memory with a tree view explorer. Each mode (Contracts/dApp) has its own independent file tree.

### Compilation Pipeline
- **Docker Sandboxed** — Contracts compile inside a Docker container with the exact Miden compiler toolchain.
- **Persistent Cargo Cache** — Docker volumes cache the cargo registry and compiled artifacts. First build: ~2 min. Subsequent builds: ~6 seconds.
- **Real-Time Streaming** — Compilation output (each "Compiling..." line) streams to the console panel as it happens via SSE.
- **Auto TX Script Generation** — After compiling a contract, Takeoff automatically generates and compiles a Rust transaction script (`#[tx_script]`) for each public method. These share the contract's compiled dependencies, so each takes ~1 second.

### Deployment
- **One-Click Deploy** — Click "Deploy" to create an on-chain account with your compiled contract code on Miden testnet.
- **Smart Storage Slots** — Deployment automatically parses `#[storage]` fields from the Rust source and creates the correct named storage slots (StorageMap or Value).
- **MidenFi Wallet Integration** — Connect via the MidenFi wallet adapter for authenticated transactions.
- **Redeploy** — Already deployed? The "Redeploy" button creates a fresh account with updated code.

### dApp Development
- **Live Preview** — Generated React components run inside the playground's own `MidenProvider` — real WASM, real hooks, real testnet data.
- **Sucrase + Eval** — TSX is transpiled in-browser via Sucrase, imports are resolved from a module map, and the component is rendered live with 500ms debounce.
- **Contract Interaction** — Pre-compiled transaction scripts are exposed via `window.__TAKEOFF_CONTRACTS` so dApp code can call contract methods through `TransactionScript.fromPackage()` → `submitNewTransaction()`.
- **Real Transactions** — Pressing "Increment Counter" in the preview executes a real transaction on Miden testnet. The counter value updates from on-chain storage.

### Developer Experience
- **Glassmorphism UI** — Apple Liquid Glass aesthetic with backdrop-blur, translucent panels, soft green glow accents, and smooth animations.
- **Resizable Panels** — IDE-style layout powered by `allotment` with drag-to-resize between all panels.
- **IndexedDB Persistence** — All state (files, chat history, compiled artifacts, contract metadata) persists across page reloads.
- **Unified Console** — Single console panel collects output from compilation, deployment, preview console.log, sync events, and errors.
- **Per-Mode State** — Editor tabs, open files, and chat history are separate for Contracts and dApp modes.

## Getting Started

### Prerequisites
- Node.js 18+
- Yarn 1.22+
- Docker Desktop (for contract compilation)
- An [Anthropic API key](https://console.anthropic.com) (for the AI assistant)

### Setup

```bash
# Clone the repo
git clone https://github.com/WiktorStarczewski/miden-takeoff.git
cd miden-takeoff

# Install dependencies
yarn install

# Build the Docker compiler image (first time only, ~5 min)
cd docker && docker compose build compiler && cd ..

# Configure the AI assistant
cp server/.env.example server/.env
# Edit server/.env and add your ANTHROPIC_API_KEY

# Start both the Vite dev server and Express backend
yarn dev:all
```

Open http://localhost:5173 in your browser.

### First Run Walkthrough

1. **Connect Wallet** — Click "Connect Wallet" in the top bar (requires MidenFi wallet extension)
2. **Generate Contract** — In the chat, type: *"Create a counter contract with increment and get_count methods"*
3. **Apply Code** — Click the "Apply to lib.rs" and "Apply to Cargo.toml" buttons on the generated code blocks
4. **Compile** — Click the "Compile" button in the sidebar. Watch the console for progress (~6s with cache, ~2 min first time)
5. **Deploy** — Click "Deploy" next to the compiled contract. The account ID appears after deployment
6. **Switch to dApp** — Click the "dApp" tab in the top bar
7. **Generate dApp** — Type: *"Build a UI for the counter contract with increment button"*
8. **Apply & Preview** — Apply the code and see the live preview with your deployed counter

## Project Structure

```
miden-takeoff/
├── src/
│   ├── main.tsx                    # React entry point
│   ├── App.tsx                     # Root with MidenProvider + wallet + persistence
│   ├── components/
│   │   ├── layout/                 # TopBar, PanelLayout, StatusBar, WalletButton
│   │   ├── editor/                 # Monaco wrapper, tabs, theme, diagnostics
│   │   ├── explorer/               # FileExplorer tree, ContractList with status
│   │   ├── chat/                   # ChatPanel, messages, input, ApplyCodeButton
│   │   ├── console/                # Unified console with level filtering
│   │   ├── preview/                # Live eval preview with ErrorBoundary
│   │   └── ui/                     # shadcn/ui primitives
│   ├── store/                      # Zustand store with 6 slices
│   │   └── slices/                 # mode, fileSystem, editor, chat, contract, console
│   ├── services/                   # API clients, preview compiler, persistence
│   ├── hooks/                      # useChat, useCompile, useDeploy, usePersistence
│   ├── lib/                        # System prompts, code parser, file templates
│   └── styles/                     # Tailwind + glassmorphism CSS variables
├── server/
│   ├── index.ts                    # Express server
│   ├── routes/                     # /api/chat (SSE), /api/compile (SSE)
│   └── services/                   # Claude API, Docker compiler orchestration
└── docker/
    ├── Dockerfile.compiler         # Rust + cargo-miden + WASM targets
    └── docker-compose.yml
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript (strict), Vite |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| Panels | `allotment` (resizable IDE layout) |
| Styling | Tailwind CSS + shadcn/ui + glassmorphism |
| State | Zustand (6 slices, per-mode state) |
| Persistence | IndexedDB (structured clone for Uint8Array) |
| Chat | react-markdown + rehype-highlight |
| Preview | Sucrase (TSX transpile) + `new Function()` eval |
| Miden SDK | `@miden-sdk/react`, `@miden-sdk/miden-sdk` (WASM) |
| Wallet | `@miden-sdk/miden-wallet-adapter-react` (MidenFi) |
| Backend | Express + `@anthropic-ai/sdk` (Claude) |
| Compiler | Docker + `cargo-miden` + `nightly-2025-12-10` |
| Icons | Lucide React |

## How It Works

### Contract Compilation

```
Rust source → Docker container → cargo-miden build → .masp package
                                                   → auto-generated tx-scripts
                                                   → cargo error diagnostics
```

The Docker compiler image has:
- `nightly-2025-12-10` Rust toolchain (matching the Miden compiler repo)
- `wasm32-unknown-unknown` + `wasm32-wasip1` targets
- `cargo-miden` 0.5.1
- `miden 0.10.0` dependencies pre-compiled (persistent Docker volume cache)

After compiling the contract, Takeoff auto-generates a Rust `#[tx_script]` project for each `pub fn` in the contract, compiles them, and stores the `.masp` bytes alongside the contract metadata.

### dApp Preview

```
AI generates TSX → Sucrase transpiles → imports resolved from MODULE_MAP
                                       → exports stripped
                                       → new Function() eval
                                       → rendered inside MidenProvider
```

The preview runs inside the same React tree as the playground — sharing the `MidenProvider`, WASM client, and wallet connection. This means hooks like `useMiden()`, `useSyncState()`, and `useAccounts()` return real data from testnet.

Pre-compiled transaction scripts are exposed via `window.__TAKEOFF_CONTRACTS` with fuzzy method name matching (via Proxy), so even if the AI writes `txScripts["increment"]` instead of `txScripts["increment_count"]`, it resolves correctly.

### Storage Reading

Contract storage is read via `account.storage().getItem(slotName)` which has been patched (PR [#1955](https://github.com/0xMiden/miden-client/pull/1955)) to return actual values for StorageMap slots instead of the useless commitment hash. This makes AI-generated code that calls `getItem` work correctly without needing to know about `getMapItem`.

## Configuration

### Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | `server/.env` | Claude API key for the AI assistant |

### AI Model

The default model is `claude-haiku-4-5-20251001` (configured in `server/services/claude.ts`). Change to `claude-sonnet-4-20250514` for better code quality at higher cost and lower rate limits.

### Network

Currently testnet-only (v1). The Vite gRPC proxy routes to the Miden testnet RPC endpoint. Configured via `midenVitePlugin()` defaults.

## Known Limitations

- **AI Code Quality** — The AI sometimes ignores specific API patterns (e.g., using `getItem` vs `getMapItem`). The patched SDK mitigates this for storage reads.
- **TX Script Parameters** — Auto-generated transaction scripts assume no-argument methods. Methods with parameters (e.g., `set_count(value: Felt)`) will fail to compile.
- **Single Contract** — The playground currently manages one contract at a time per compilation.
- **No Light Mode** — Dark theme only.
- **Compilation Speed** — First compilation downloads and compiles ~312 Rust crates (~2 min). Subsequent builds are cached (~6s).

## Contributing

This project is in active development. Issues and PRs welcome.

## License

MIT
