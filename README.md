# Betaflight MCP

## Architecture
The server exposes Betaflight flight controller control over two complementary interfaces that share a single serial connection:

- **MSP binary protocol** (`src/msp/`) — for real-time sensor reads (attitude, IMU, GPS, RC, motors). Structured, typed, low-latency.
- **CLI text interface** (`src/cli/`) — for all configuration: feature flags, variable get/set, dump/diff, save.

## CLI commands and variables as MCP tools
All the commands and variables that can be set via CLI are available as MCP tools, including their descriptions, args and constraints.
https://github.com/betaflight/betaflight.com/raw/refs/heads/master/docs/development/Cli.md

## Development
`pnpm build` automatically runs `pnpm generate` as a prebuild step to fetch the latest CLI.md and regenerate `src/generated/variables.ts`.
Always run `pnpm typecheck` after editing any source files to catch errors before building.
