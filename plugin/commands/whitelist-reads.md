---
name: betaflight-whitelist-reads
description: Add all betaflight-mcp read tools (get_*) to the Claude Code allow-list so they run without per-call confirmation. Safe to run multiple times.
context: fork
model: haiku
allowed-tools: Read, Write, Bash
---

Add all `get_*` betaflight-mcp tools to the Claude Code permissions allow-list so they run automatically without per-call confirmation.

## What this command does

Adds every `get_<varname>` tool (one per CLI variable, ~762 tools) plus essential read-only command tools to the `permissions.allow` array in `~/.claude/settings.json`.

> **Important**: Claude Code's `permissions.allow` requires **exact tool names** — glob wildcards like `get_*` are not supported for MCP tools and will be silently ignored. This command enumerates all tool names explicitly.

Only **read** tools are whitelisted — `set_*`, `cli_save`, `motor_set`, and connection/destructive tools are intentionally excluded and will still prompt for confirmation.

## Steps

1. Determine the settings file path:
   - Target: `~/.claude/settings.json` (global, applies to all projects)
   - Expand `~` to the absolute home directory path.

2. Read the file if it exists, or start with `{}`.

3. Ensure the JSON has a `permissions.allow` array. If it doesn't exist, create it.

4. Use Bash to extract all `get_*` tool names from `src/generated/variables.ts` in the current working directory:

   ```bash
   grep -o "registerTool(\s*'get_[^']*'" src/generated/variables.ts | grep -o "'get_[^']*'" | tr -d "'"
   ```

   If `src/generated/variables.ts` is not found, skip the variable tools and warn the user.

5. Build the full list of tool names to allow. Each extracted name `get_<varname>` becomes `mcp__plugin_betaflight-mcp_betaflight__get_<varname>`. In addition, always include these fixed tools:
   - `mcp__plugin_betaflight-mcp_betaflight__list_serial_ports`
   - `mcp__plugin_betaflight-mcp_betaflight__preflight_check`
   - `mcp__plugin_betaflight-mcp_betaflight__get_pid_sliders`
   - `mcp__plugin_betaflight-mcp_betaflight__get_aux_config`
   - `mcp__plugin_betaflight-mcp_betaflight__get_channel_map`
   - `mcp__plugin_betaflight-mcp_betaflight__get_mixer`
   - `mcp__plugin_betaflight-mcp_betaflight__get_serial_config`
   - `mcp__plugin_betaflight-mcp_betaflight__get_tasks`
   - `mcp__plugin_betaflight-mcp_betaflight__get_version`
   - `mcp__plugin_betaflight-mcp_betaflight__get_status`
   - `mcp__plugin_betaflight-mcp_betaflight__get_raw_imu`
   - `mcp__plugin_betaflight-mcp_betaflight__get_attitude`
   - `mcp__plugin_betaflight-mcp_betaflight__get_altitude`
   - `mcp__plugin_betaflight-mcp_betaflight__get_battery`
   - `mcp__plugin_betaflight-mcp_betaflight__get_battery_state`
   - `mcp__plugin_betaflight-mcp_betaflight__get_rc_channels`
   - `mcp__plugin_betaflight-mcp_betaflight__get_motor_values`
   - `mcp__plugin_betaflight-mcp_betaflight__get_gps_data`
   - `mcp__plugin_betaflight-mcp_betaflight__feature_list`
   - `mcp__plugin_betaflight-mcp_betaflight__cli_status`
   - `mcp__plugin_betaflight-mcp_betaflight__cli_help`
   - `mcp__plugin_betaflight-mcp_betaflight__cli_diff`
   - `mcp__plugin_betaflight-mcp_betaflight__cli_dump`
   - `mcp__plugin_betaflight-mcp_betaflight__motor_get`

   Deduplicate: skip any entry already present in the existing `permissions.allow` array.

6. Also remove any stale wildcard entry `mcp__plugin_betaflight-mcp_betaflight__get_*` if present (it has no effect and is misleading).

7. Write the updated JSON back to `~/.claude/settings.json` using `JSON.stringify` with 2-space indent. Preserve all existing settings.

8. Confirm to the user:
   - How many entries were added (skip those already present).
   - That **write tools** (`set_*`, `cli_save`, `cli_exec`, `motor_set`, `feature_enable/disable`, `reboot_flight_controller`, `calibrate_*`, `connect_flight_controller`, `disconnect_flight_controller`, `erase_blackbox_logs`, `cli_defaults`) are intentionally **not** whitelisted and will still prompt for confirmation.
   - That Claude Code will apply the new permissions immediately — no restart needed.
