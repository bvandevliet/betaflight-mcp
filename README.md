# Betaflight MCP

An MCP (Model Context Protocol) server that exposes Betaflight flight controller control to AI assistants such as Claude. It communicates with the FC over a serial connection using the MSP binary protocol and the Betaflight CLI text interface. Use it at your own risk — it can send any command the CLI allows, including ones that may cause crashes, flyaways, or other unsafe conditions if misused. Always review tool actions before approving them in Claude.

## Compatibility

- Betaflight firmware v2025.12 or later

## Features

- Real-time sensor reads — attitude, IMU, GPS, RC channels, motors, battery
- Full CLI access — feature flags, variable get/set, dump/diff, save, defaults
- Auto-generated variable tools: ~750 CLI-configurable variables each exposed as a `get_<name>` / `set_<name>` tool pair, derived from the Betaflight firmware source
- Expert PID tuning skill — automatically activates in Claude Code when tuning topics come up

## Claude Code Plugin

This repo ships a Claude Code plugin in the `plugin/` directory, which bundles:
- The **PID tuning skill** — activates automatically when you mention Betaflight, PID tuning, filter tuning, propwash, oscillations, etc.
- The **MCP server config** — connects Claude Code to the betaflight-mcp server

### Install the plugin

**1. Build the server** (required before first use):

```bash
pnpm install
pnpm build
```

**2. Add the local marketplace**:

```bash
claude plugin marketplace add /path/to/betaflight-mcp
claude plugin install betaflight-mcp@betaflight-mcp
```

Replace `/path/to/betaflight-mcp` with the absolute path to your cloned repository (the repo root, not the `plugin/` subdirectory).

**3. Configure the server path and whitelist read tools** — run the setup script:

```bash
pnpm run setup
pnpm whitelist-reads
```

This replaces the placeholder in the cached plugin's `.mcp.json` with the absolute path to `dist/server.js` on your machine. The repo's `plugin/.mcp.json` is left untouched so the placeholder stays clean for git. Restart Claude Code afterwards. The whitelist script adds all read-only MCP tools to the allowed tools list of Claude, so you don't have to manually approve them all the time. Write access tools are never whitelisted by default for safety.

### Updating the plugin

After pulling new changes from the repo, rebuild and reinstall the plugin:

```bash
pnpm build
claude plugin uninstall betaflight-mcp@betaflight-mcp
claude plugin install betaflight-mcp@betaflight-mcp
```

Then re-run the setup and whitelist scripts:

```bash
pnpm run setup
pnpm whitelist-reads
```

> **Claude Desktop users:** The plugin system is a Claude Code (CLI) feature and is not available in Claude Desktop. Claude Desktop users configure the MCP server manually via `claude_desktop_config.json` (see platform-specific setup below) — this gives full access to all ~1500 tools. The PID tuning skill does not auto-activate in Claude Desktop; as a workaround, create a [Claude Project](https://support.anthropic.com/en/articles/9517075-what-are-projects) and attach `plugin/skills/betaflight-pid-tuning/SKILL.md` as project knowledge so it is always in context.

## CLI commands and variables as MCP tools

All CLI-configurable variables are exposed as individual `get_<name>` / `set_<name>` tool pairs, auto-generated from the Betaflight firmware source (`settings.c`, ~750 variables), enriched with descriptions from the CLI reference docs.

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
- [Claude Desktop](https://claude.ai/download) (latest version)

#### 1. Install and build

```powershell
pnpm install
pnpm build
```

The build command automatically runs `pnpm generate` to fetch the latest Betaflight firmware sources and generate variable tools.

#### 2. Find your COM port

Open **Device Manager** → **Ports (COM & LPT)** and note the port assigned to your flight controller (e.g. `COM3`).

#### 3. Configure Claude Desktop

Click the Claude menu and select **Settings…**, then navigate to the **Developer** tab and click **Edit Config**.

This opens `%APPDATA%\Claude\claude_desktop_config.json`. Add the following configuration:

```json
{
  ...,
  "mcpServers": {
    ...,
    "betaflight": {
      "command": "node",
      "args": ["C:\\path\\to\\betaflight-mcp\\dist\\server.js"]
    }
  }
}
```

**Replace** `C:\\path\\to\\betaflight-mcp` with the absolute path to your cloned repository. Use escaped backslashes (`\\`) or forward slashes (`/`).

> **Understanding the Configuration:**
> - `"betaflight"`: A friendly name that appears in Claude Desktop
> - `"command": "node"`: Runs the server using Node.js
> - `"args"`: Path to the compiled server JavaScript file

> **Security Consideration:**
> The server requires access to serial ports to communicate with your flight controller. It runs with your user account permissions. Only connect to flight controllers you trust and always review tool actions before approving them in Claude.

#### 4. Restart Claude Desktop

Completely quit and restart Claude Desktop to load the new configuration.

#### 5. Verify the connection

Upon successful restart, you'll see an MCP server indicator (hammer icon) in the bottom-right corner of the conversation input box. Click it to view available Betaflight tools.

To connect to your flight controller, tell Claude:
```
Connect to my flight controller on COM3
```

Claude will use the `connect_flight_controller` tool with your specified COM port.

### Windows — Docker via USBIPD (advanced)

If you prefer Docker on Windows, you'll need to bridge USB devices into WSL2.

#### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) with WSL2 integration enabled
- [USBIPD-WIN](https://github.com/dorssel/usbipd-win) for USB device sharing

#### 1. Share your USB device with WSL2

In an elevated PowerShell:

```powershell
# Find your flight controller's BUSID
usbipd list

# Bind and attach the device to WSL2
usbipd bind --busid <BUSID>
usbipd attach --wsl --busid <BUSID>
```

#### 2. Verify device in WSL2

Open a WSL2 terminal and verify the device appears:

```bash
ls /dev/ttyACM*
```

#### 3. Build the Docker image

From your WSL2 terminal in the project directory:

```bash
docker build -t betaflight-mcp .
```

#### 4. Configure Claude Desktop

Follow the [Linux/macOS Docker configuration steps](#3-configure-claude-desktop-1) above, using the device path from WSL2 (e.g., `/dev/ttyACM0`).

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

Click the Claude menu and select **Settings…**, then navigate to the **Developer** tab and click **Edit Config**.

This opens the configuration file:

| Platform | Path |
|----------|------|
| macOS    | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux    | `~/.config/Claude/claude_desktop_config.json` |

Add the following configuration, replacing `/dev/ttyACM0` with your actual device path:

```json
{
  "mcpServers": {
    ...,
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

> **Understanding the Configuration:**
> - `"betaflight"`: A friendly name that appears in Claude Desktop
> - `"command": "docker"`: Runs the server in a Docker container
> - `"--rm"`: Automatically removes the container after exit
> - `"-i"`: Enables interactive mode for stdio communication
> - `"--device"`: Grants the container access to the serial device

> **Security Consideration:**
> Granting Docker access to a serial device allows the container to communicate with your flight controller. The container runs with limited permissions, but ensure you only connect to flight controllers you trust.

#### 4. Restart Claude Desktop

Completely quit and restart Claude Desktop to load the new configuration.

#### 5. Verify the connection

Upon successful restart, you'll see an MCP server indicator (hammer icon) in the bottom-right corner of the conversation input box. Click it to view available Betaflight tools.

To connect to your flight controller, tell Claude:
```
Connect to my flight controller on /dev/ttyACM0
```

Claude will use the `connect_flight_controller` tool with your specified device path.
