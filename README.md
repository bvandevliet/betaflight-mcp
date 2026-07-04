# Betaflight MCP

An MCP (Model Context Protocol) server that exposes Betaflight flight controller control to AI assistants such as Claude. It communicates with the FC over a serial connection using the MSP binary protocol and the Betaflight CLI text interface. Use it at your own risk — it can send any command the CLI allows, including ones that may cause crashes, flyaways, or other unsafe conditions if misused. Always review tool actions before approving them in Claude.

## Compatibility

- Betaflight firmware v2025.12 or later

## Features

- Real-time sensor reads — attitude, IMU, GPS, RC channels, motors, battery
- Full CLI access — feature flags, variable get/set, dump/diff, save, defaults
- Auto-generated variable tools: ~375 CLI-configurable variables each exposed as a `get_<name>` / `set_<name>` tool pair, derived from the Betaflight firmware source
- Expert PID tuning skill — automatically activates in Claude Code when tuning topics come up

## Quick start (any MCP client)

The server is published on npm and runs via `npx` — no clone, no build, no compiler required. This works identically in Claude Desktop, Claude Code, Cursor, Windsurf, VS Code's MCP support, or any other MCP host, since they all understand the same `command`/`args` shape.

Add this to your client's MCP config:

```json
{
  "mcpServers": {
    "betaflight": {
      "command": "npx",
      "args": ["-y", "betaflight-mcp"]
    }
  }
}
```

| Client | Config file |
|---|---|
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Linux) | `~/.config/Claude/claude_desktop_config.json` |
| Claude Code | `.mcp.json` in your project, or `claude mcp add` |
| Cursor | `.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |

Restart your client, connect your flight controller over USB, and find its serial device:

```bash
# Windows: Device Manager → Ports (COM & LPT), e.g. COM3
# Linux:   ls /dev/tty{USB,ACM}*
# macOS:   ls /dev/cu.*
```

Then tell the assistant: `Connect to my flight controller on COM3` (or `/dev/ttyACM0`).

> **Security consideration:** The server needs access to serial ports to talk to your flight controller and runs with your user account's permissions. It can send any command the Betaflight CLI allows. Only connect to flight controllers you trust and always review tool calls before approving them.

`npx` fetches prebuilt native binaries for the serial port driver — no C++ build toolchain (Visual Studio Build Tools, Xcode CLT, `build-essential`) is required on any of Windows, macOS, or Linux (x64/arm64).

## Claude Code Plugin

This repo ships a Claude Code plugin in the `plugin/` directory, which bundles:
- The **PID tuning skill** — activates automatically when you mention Betaflight, PID tuning, filter tuning, propwash, oscillations, etc.
- The **MCP server config** — connects Claude Code to the betaflight-mcp server via `npx` (same as the quick start above)

### Install the plugin

```bash
claude plugin marketplace add bvandevliet/betaflight-mcp
claude plugin install betaflight-mcp@betaflight-mcp
```

Then whitelist the read-only tools so Claude doesn't ask for approval on every read:

```bash
npx -y betaflight-mcp-whitelist-reads
```

Restart Claude Code afterwards. Write tools (`set_*`, `cli_save`, `cli_exec`, `motor_set`, etc.) are never whitelisted by default.

### Updating the plugin

```bash
claude plugin uninstall betaflight-mcp@betaflight-mcp
claude plugin install betaflight-mcp@betaflight-mcp
```

Since the plugin's `.mcp.json` runs `npx -y betaflight-mcp`, it always resolves the latest published version — no rebuild or path reconfiguration needed.

> **Claude Desktop users:** The plugin system is a Claude Code (CLI) feature and is not available in Claude Desktop. Use the [Quick start](#quick-start-any-mcp-client) config above instead — this gives full access to all ~1500 tools. The PID tuning skill does not auto-activate in Claude Desktop; as a workaround, create a [Claude Project](https://support.anthropic.com/en/articles/9517075-what-are-projects) and attach `plugin/skills/betaflight-pid-tuning/SKILL.md` as project knowledge so it is always in context.

## CLI commands and variables as MCP tools

Relevant CLI-configurable variables are exposed as individual `get_<name>` / `set_<name>` tool pairs, auto-generated from the Betaflight firmware source (`settings.c`, ~375 variables), enriched with descriptions from the CLI reference docs.

Run `pnpm generate` to regenerate `src/generated/variables.ts` after a Betaflight release.

## Development

```bash
pnpm install
pnpm generate      # Re-fetch firmware sources + Cli.md, regenerate src/generated/variables.ts
pnpm dev           # Run directly via tsx (no build step)
pnpm build         # pnpm generate (prebuild) → tsc → dist/
pnpm typecheck     # Type-check without emitting
pnpm lint          # ESLint over src/
```

### Testing a local checkout as the `npx` target

To exercise your own changes through an MCP client (instead of the published npm version), link the package globally after building:

```bash
pnpm build
pnpm link --global
```

Then point your client config at the linked binary instead of `npx`:

```json
{
  "mcpServers": {
    "betaflight": {
      "command": "betaflight-mcp"
    }
  }
}
```

`pnpm unlink --global` reverts to the registry version.

## Architecture

```
MCP client (Claude Desktop, Claude Code, Cursor, …)
    │  stdio (MCP JSON-RPC)
    ▼
betaflight-mcp
    ├── MSP binary protocol  ←→  FC (real-time sensor reads)
    └── CLI text interface   ←→  FC (configuration, variables)
```

The server communicates over **stdio** — the host launches it as a subprocess and pipes stdin/stdout for MCP JSON-RPC; there is no HTTP port. It maintains a single serial connection shared between the MSP client and the CLI client, serialised via a FIFO mutex so commands never interleave on the wire.

## Alternative: Docker

Docker is useful for containerized or offline deployments, but isn't required — see [Quick start](#quick-start-any-mcp-client) for the standard `npx` install.

```bash
docker build -t betaflight-mcp .
```

Then reference the container instead of `npx` in your client config, granting access to your flight controller's serial device:

```json
{
  "mcpServers": {
    "betaflight": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "--device", "/dev/ttyACM0:/dev/ttyACM0",
        "betaflight-mcp"
      ]
    }
  }
}
```

Replace `/dev/ttyACM0` with your actual device path (see [Quick start](#quick-start-any-mcp-client) for finding it per OS).

**Windows**: Docker Desktop runs containers in a WSL2 Linux VM, so passing a COM port through requires bridging it into WSL2 with [USBIPD-WIN](https://github.com/dorssel/usbipd-win) first (`usbipd bind`/`usbipd attach --wsl`), then referencing the resulting `/dev/ttyACM*` path from inside WSL2. This is more involved than the native `npx` path above — prefer `npx` on Windows unless you specifically need a container.

> **Security consideration:** Granting Docker access to a serial device allows the container to communicate with your flight controller. Only connect to flight controllers you trust.
