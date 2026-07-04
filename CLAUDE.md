# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Commands

```bash
pnpm generate          # Fetch firmware sources + Cli.md from GitHub, regenerate src/generated/variables.ts
pnpm typecheck         # Type-check without emitting (tsc --noEmit)
pnpm build             # pnpm generate (prebuild) → tsc → dist/
pnpm build:watch       # Incremental watch build
pnpm dev               # Run server directly via tsx (no build step)
pnpm start             # Run compiled dist/server.js
pnpm lint              # ESLint over src/
```

`pnpm build` automatically runs `pnpm generate` as a prebuild step. Always run `pnpm typecheck` after editing any source files to catch errors before building.

## Architecture

The server exposes Betaflight flight controller control over two complementary interfaces that share a single serial connection:

- **MSP binary protocol** (`src/msp/`) — for real-time sensor reads (attitude, IMU, GPS, RC, motors). Structured, typed, low-latency.
- **CLI text interface** (`src/cli/`) — for all configuration: feature flags, variable get/set, dump/diff, save.

### Session model (`src/state.ts`)

A module-level singleton `Session` holds the live connection. All tools call `requireSession()` which throws if no FC is connected. `createSession()` wires `transport.onClose` → `destroySession()` for automatic cleanup on unexpected disconnect.

```
Session
 ├── SerialTransport   — raw serial I/O, data listener fan-out
 ├── MspClient         — sends MSP frames, resolves pending requests by code
 ├── CliClient         — enters CLI mode (#), executes commands, detects prompt
 └── lock (Mutex)      — FIFO promise-chain shared by both clients
```

`MspClient` and `CliClient` both register data listeners on the same `SerialTransport`. They operate on different byte patterns (binary MSP frames vs. text CLI prompt), so they can coexist without interference. The shared `lock` serialises access so CLI commands and MSP requests don't interleave on the wire.

### MSP layer (`src/msp/`)

- `codes.ts` — MSP command code constants. Codes ≤ 255 use MSPv1; codes > 255 use MSPv2.
- `protocol.ts` — stateless encode functions (`encodeMspV1`, `encodeMspV2`, `encodeMsp`) + `MspFrameParser` (byte-by-byte state machine, calls `onFrame(code, payload, version)` on valid frames).
- `client.ts` — `MspClient` maps pending requests by code; each `request(code)` sets a 5 s timeout and resolves when the parser fires `onFrame` with matching code.

**Limitation**: one in-flight request per MSP code at a time (map key is the code). Don't issue concurrent requests for the same code.

### CLI layer (`src/cli/client.ts`)

`CliClient.execCommand()`:
1. Acquires the shared lock (FIFO).
2. Calls `_enterCli()` (idempotent — sends `#`, polls for `# ` prompt, sets `inCli = true`).
3. Clears buffer, writes `cmd\n`, polls for `# ` prompt (10 s; 15 s for `dump`/`diff`).
4. Strips echoed command (everything before first `\n`) and trailing prompt.

`execCommandAndDisconnect()` is used for `save` and `defaults` — after sending the command it waits 500 ms then closes the transport. The FC reboots; the connection is intentionally destroyed.

### Tool registration (`src/tools/`, `src/generated/`)

Each `tools/*.ts` file exports a `register*Tools(server: McpServer)` function. `src/server.ts` calls them all at startup. All tools call `requireSession()` and wrap errors in a `{ content: [{ type: 'text', text: ... }] }` response rather than throwing, so MCP clients see clean error messages. Connection tools (`list_serial_ports`, `connect_flight_controller`, `reconnect_flight_controller`, `disconnect_flight_controller`) live in `src/tools/connection.ts`.

**Buffer reads in `realtime.ts`**: all use local helper functions (`readU8`, `readU16LE`, `readI16LE`, `readU32LE`, `readI32LE`) that check for `undefined` before returning, satisfying `noUncheckedIndexedAccess`.

`src/tools/sliders.ts` — `get_pid_sliders` / `set_pid_sliders` tools. Uses MSP 140 to read; MSP 143/144 to preview filter Hz; MSP 141 to commit all simplified_* vars and recompute gains.

`src/tools/system.ts` — system management tools: `reboot_flight_controller`, `calibrate_accelerometer`, `calibrate_magnetometer`, `get_dataflash_summary`, `erase_blackbox_logs`, `get_arming_disable_flags`, `get_current_profile`, `set_pid_profile`, `set_rate_profile`, `copy_pid_profile`, `preflight_check`.

### Simplified tuning MSP protocol (`src/tools/sliders.ts`)

- **MSP 140** (`GET_SIMPLIFIED_TUNING`): 53-byte response. PID section bytes 0–16, dterm filter 17–34, gyro filter 35–52.
- **MSP 141** (`SET_SIMPLIFIED_TUNING`): the operative commit command. Reads all simplified_* control vars from the full 53-byte payload, writes them to pgCopy, then calls `applySimplifiedTuning()` internally — computing PID gains + gyro/dterm filter Hz in one step. Without this, `cli_save` persists the computed p/i/d values but simplified_* reverts to EEPROM defaults on reboot.
- **MSP 142** (`CALCULATE_SIMPLIFIED_PID`): preview command used by Configurator on every slider move. Operates on a temp copy, returns computed p/i/d/f values. **Not called by `set_pid_sliders`** — MSP 141 handles PID recalculation internally.
- **Correct save flow**: MSP 143/144 (optional: compute filter Hz for updated payload) → MSP 141 full 53-byte payload (write simplified_* + recompute all gains) → `cli_save` (persist pgCopy to EEPROM).
- **Slider ↔ uint8 conversion**: `Math.round(float * 100)` for storage; `/ 100` for display. E.g. 1.2 → 120.
- **CLI `simplified_*` variables require `simplified_tuning apply`**: setting e.g. `simplified_i_gain = 150` via CLI saves the variable but never triggers PID recalculation. The FC does not auto-recalculate on boot. Configurator's `MSP_VALIDATE_SIMPLIFIED_TUNING` (145) detects the mismatch and disables sliders with a warning. **Valid CLI flow**: `set simplified_* = value` → `simplified_tuning apply` → `save`. CLI `apply` is functionally equivalent to MSP 142+143+144+141 but **recalculates all PID profiles**, not just the active one. Prefer `set_pid_sliders` (MSP path) when targeting only the active profile.
- **CLI mode and MSP**: The FC ignores MSP frames while in CLI mode. Call `session.cliClient.exitCli()` (under the session lock) before any MSP request that may follow CLI activity.

### Code generation (`scripts/generate-variables.ts`)

Fetches three sources in parallel and merges them:

1. **`parameter_names.h`** — resolves `PARAM_NAME_*` macros to CLI string names.
2. **`settings.c`** — authoritative variable list. Parsed via a brace-depth state machine that extracts each `valueTable[]` entry. Provides var type (`VAR_UINT8` etc.), scope (`MASTER`/`PROFILE`/etc.), mode flags (`MODE_LOOKUP`/`MODE_BITSET`/etc.), and numeric ranges from `.config.minmax` / `.config.minmaxUnsigned` / `.config.u32Max`.
3. **`Cli.md`** — ~106 vars with human descriptions and default values; used only to enrich C-derived entries. **Never a fallback source**: 31 Cli.md entries are removed/renamed vars absent from current firmware. If `settings.c` is unavailable, the generator exits with an error.

Datatype → Zod schema mapping: integer types → `z.number().int().min().max()`, `FLOAT` → `z.number().min().max()`, `MODE_LOOKUP` → `z.string()`, `MODE_BITSET` → `z.enum(['OFF', 'ON'])`, ON/OFF min/max → `z.enum(['OFF', 'ON'])`, anything else → `z.string()`. Range bounds omitted when only symbolic constants (e.g. `LPF_MAX_HZ`) are used; FC enforces bounds at runtime.

Output is `src/generated/variables.ts` — **committed to git**, so the server can run without re-fetching docs. Re-run `pnpm generate` to update when Betaflight releases new firmware.

**Variable scope filter**: only variables whose `### <section>` heading in `wiki/cli-reference.md` appears in the `INCLUDED_SECTIONS` set at the top of `generate-variables.ts` are emitted. To add or remove coverage, edit that set — names must match the headings exactly (including em-dashes and punctuation). `cli-reference.md` is parsed twice: once for descriptions (`parseLocalCliRef`), once for section membership (`parseAllowedVarNames`).

## TypeScript strict-mode requirements

- `noUncheckedIndexedAccess` — guard every `array[i]` / `buffer[i]` access. Use the read helpers in `realtime.ts` or `if (b === undefined) continue` pattern from `protocol.ts`.
- `exactOptionalPropertyTypes` — never assign `undefined` to optional properties; use conditional spread instead (see `serial.ts` `listPorts`).
- `verbatimModuleSyntax` — use `import type` for type-only imports.
- All internal imports use `.js` extension (ESM `"module": "nodenext"`).
- All diagnostic/debug output goes to `process.stderr` — stdout is reserved for MCP JSON-RPC.
- Use `server.registerTool()` — not the deprecated `server.tool()`.

**Security hook**: a project plugin (`security_reminder_hook.py`) blocks the first edit per session to any file containing `exec(` — this includes regex `.exec()` calls (false positive). It only fires once per file per session; retry the same edit and it will go through.

## Plugin & Skills

The `plugin/` directory configures this repo as a Claude Code plugin. The primary skill is:

- **`plugin/skills/betaflight-pid-tuning/SKILL.md`** — Expert Betaflight PID/filter tuning assistant with full Betaflight domain knowledge. Load this when working on any task involving Betaflight configuration, CLI variables, PID tuning, MCP tool behaviour, or flight controller integration. It documents the full set of CLI variables, tuning methodology, and MCP tool usage patterns.

Reference docs for the skill live in `plugin/skills/betaflight-pid-tuning/references/`:
- `betaflight-docs/` — official CLI references, tuning notes, feature guides
- `youtube-transcript-summaries/` — Chris Rosser and PIDtoolbox methodology summaries

## Reference sources

When implementing new MSP tools or fixing protocol issues, refer to the upstream Betaflight Configurator source:
- MSP codes: `https://github.com/betaflight/betaflight-configurator/raw/refs/heads/master/src/js/msp/MSPCodes.js`
- MSP framing/parsing: `MSPConnector.js`, `MSPHelper.js` in the same directory
- CLI variables reference: `https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/development/Cli.md`
- Slider protocol (authoritative): `src/js/tabs/pid_tuning/TuningSliders.js` in betaflight-configurator — cross-check this when implementing or debugging any simplified tuning MSP work
- CLI variable names (macros): `https://github.com/betaflight/betaflight/raw/refs/heads/master/src/main/fc/parameter_names.h`
- CLI variable definitions (authoritative, ~500 vars): `https://github.com/betaflight/betaflight/raw/refs/heads/master/src/main/cli/settings.c`
