# Betaflight MCP

An MCP (Model Context Protocol) server that exposes Betaflight flight controller control to AI assistants such as Claude. It communicates with the FC over a serial connection using the MSP binary protocol and the Betaflight CLI text interface.

## Features

- Real-time sensor reads — attitude, IMU, GPS, RC channels, motors, battery
- Full CLI access — feature flags, variable get/set, dump/diff, save, defaults
- Auto-generated variable tools: ~762 CLI-configurable variables each exposed as a `get_<name>` / `set_<name>` tool pair, derived from the Betaflight firmware source

## CLI commands and variables as MCP tools

All CLI-configurable variables are exposed as individual `get_<name>` / `set_<name>` tool pairs, auto-generated from the Betaflight firmware source (`settings.c`, ~762 variables), enriched with descriptions from the CLI reference docs.

Run `pnpm generate` to regenerate `src/generated/variables.ts` after a Betaflight release.

## Development

```bash
pnpm generate      # Re-fetch firmware sources + Cli.md, regenerate src/generated/variables.ts
pnpm dev           # Run directly via tsx (no build step)
pnpm build         # pnpm generate (prebuild) → tsc → dist/
pnpm typecheck     # Type-check without emitting
pnpm lint          # ESLint over src/
```

## Architecture

```
Claude Desktop
    │  stdio (MCP JSON-RPC)
    ▼
betaflight-mcp
    ├── MSP binary protocol  ←→  FC (real-time sensor reads)
    └── CLI text interface   ←→  FC (configuration, variables)
```

The server maintains a single serial connection shared between the MSP client and the CLI client, serialised via a FIFO mutex so commands never interleave on the wire.

## Using with Claude Desktop

The server communicates over **stdio** — Claude Desktop spawns it as a subprocess and pipes stdin/stdout for MCP JSON-RPC. There is no HTTP port.

Choose the approach that matches your operating system.

### Windows — Native (recommended)

Docker Desktop on Windows uses a WSL2 Linux VM. Passing COM ports into a Linux container requires [USBIPD-WIN](https://github.com/dorssel/usbipd-win) and is non-trivial. Running the server natively with Node.js is the simpler path on Windows.

#### Prerequisites

- [Node.js 22+](https://nodejs.org/) (LTS)
- [pnpm](https://pnpm.io/installation): `npm install -g pnpm`
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **Desktop development with C++** workload (required to compile the `serialport` native addon)

#### 1. Install and build

```powershell
pnpm install
pnpm build
```

#### 2. Find your COM port

Open **Device Manager** → **Ports (COM & LPT)** and note the port assigned to your flight controller (e.g. `COM3`).

#### 3. Configure Claude Desktop

Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "betaflight": {
      "command": "node",
      "args": ["C:\\path\\to\\betaflight-mcp\\dist\\server.js"]
    }
  }
}
```

Use escaped backslashes or forward slashes in the path. Restart Claude Desktop.

When connecting from Claude, pass your COM port (e.g. `COM3`) as the port argument to the `connect_flight_controller` tool.

### Windows — Docker via USBIPD (advanced)

If you prefer Docker on Windows:

1. Install [USBIPD-WIN](https://github.com/dorssel/usbipd-win).
2. In an elevated PowerShell, bind and attach your FC's USB device to WSL2:
   ```powershell
   usbipd list                       # find the BUSID for your FC
   usbipd bind --busid <BUSID>
   usbipd attach --wsl --busid <BUSID>
   ```
3. In WSL2, verify the device appears (e.g. `/dev/ttyACM0`).
4. Build the image from WSL2: `docker build -t betaflight-mcp .`
5. Use the Linux/macOS Claude Desktop config above (Docker Desktop must have WSL2 integration enabled).

### Linux / macOS — Docker (recommended)

#### 1. Build the image

```bash
docker build -t betaflight-mcp .
```

The build fetches the latest Betaflight firmware sources and CLI reference from GitHub and compiles TypeScript. An internet connection is required.

#### 2. Find your serial device path

Connect your flight controller via USB, then:

```bash
# Linux
ls /dev/tty{USB,ACM}*

# macOS
ls /dev/cu.*
```

Common values: `/dev/ttyUSB0`, `/dev/ttyACM0` (Linux) · `/dev/cu.usbmodem*` (macOS).

#### 3. Configure Claude Desktop

Edit `claude_desktop_config.json`:

| Platform | Path |
|----------|------|
| macOS    | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux    | `~/.config/Claude/claude_desktop_config.json` |

Replace `/dev/ttyACM0` with your actual device path:

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

Restart Claude Desktop. The betaflight tools will appear in the tool list.
