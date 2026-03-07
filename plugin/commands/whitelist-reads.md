---
name: betaflight-whitelist-reads
description: Add all betaflight-mcp read tools (get_*) to the Claude Code allow-list so they run without per-call confirmation. Safe to run multiple times.
context: fork
model: haiku
allowed-tools: Read, Write, Bash
---

Add all `get_*` betaflight-mcp tools to the Claude Code permissions allow-list so they run automatically without per-call confirmation.

## What this command does

Appends `mcp__plugin_betaflight-mcp_betaflight__get_*` (and a few essential non-write tools) to the `permissions.allow` array in the user's global Claude Code settings at `~/.claude/settings.json`. Only **read** tools are whitelisted — `set_*`, `cli_save`, `motor_set`, and connection tools are intentionally excluded.

## Steps

1. Determine the settings file path:
   - Target: `~/.claude/settings.json` (global, applies to all projects)
   - Expand `~` to the absolute home directory path.

2. Read the file if it exists, or start with `{}`.

3. Ensure the JSON has a `permissions.allow` array. If it doesn't exist, create it.

4. Add the following entries to `permissions.allow` if they are not already present:
   - `"mcp__plugin_betaflight-mcp_betaflight__get_*"` — all variable/config reads
   - `"mcp__plugin_betaflight-mcp_betaflight__list_serial_ports"` — port discovery
   - `"mcp__plugin_betaflight-mcp_betaflight__preflight_check"` — preflight checks
   - `"mcp__plugin_betaflight-mcp_betaflight__get_pid_sliders"` — PID slider reads
   - `"mcp__plugin_betaflight-mcp_betaflight__get_aux_config"` — AUX config reads
   - `"mcp__plugin_betaflight-mcp_betaflight__get_channel_map"` — channel map reads
   - `"mcp__plugin_betaflight-mcp_betaflight__get_mixer"` — mixer reads
   - `"mcp__plugin_betaflight-mcp_betaflight__get_serial_config"` — serial config reads
   - `"mcp__plugin_betaflight-mcp_betaflight__get_tasks"` — task reads
   - `"mcp__plugin_betaflight-mcp_betaflight__get_version"` — version reads
   - `"mcp__plugin_betaflight-mcp_betaflight__get_status"` — status reads
   - `"mcp__plugin_betaflight-mcp_betaflight__get_raw_imu"` — IMU reads
   - `"mcp__plugin_betaflight-mcp_betaflight__get_attitude"` — attitude reads
   - `"mcp__plugin_betaflight-mcp_betaflight__get_altitude"` — altitude reads
   - `"mcp__plugin_betaflight-mcp_betaflight__get_battery"` — battery reads
   - `"mcp__plugin_betaflight-mcp_betaflight__get_battery_state"` — battery state reads
   - `"mcp__plugin_betaflight-mcp_betaflight__get_rc_channels"` — RC channel reads
   - `"mcp__plugin_betaflight-mcp_betaflight__get_motor_values"` — motor value reads (read-only, safe)
   - `"mcp__plugin_betaflight-mcp_betaflight__get_gps_data"` — GPS reads
   - `"mcp__plugin_betaflight-mcp_betaflight__feature_list"` — feature list
   - `"mcp__plugin_betaflight-mcp_betaflight__cli_status"` — CLI status
   - `"mcp__plugin_betaflight-mcp_betaflight__cli_help"` — CLI help
   - `"mcp__plugin_betaflight-mcp_betaflight__cli_diff"` — diff (read-only)
   - `"mcp__plugin_betaflight-mcp_betaflight__cli_dump"` — dump (read-only)
   - `"mcp__plugin_betaflight-mcp_betaflight__motor_get"` — motor get (read-only)

   Use `JSON.stringify` with 2-space indent when writing. Preserve all existing settings.

5. Write the updated JSON back to `~/.claude/settings.json`.

6. Confirm to the user:
   - How many entries were added (skip those already present).
   - That **write tools** (`set_*`, `cli_save`, `cli_exec`, `motor_set`, `feature_enable/disable`, `reboot_flight_controller`, `calibrate_*`, `connect_flight_controller`, `disconnect_flight_controller`, `erase_blackbox_logs`, `cli_defaults`) are intentionally **not** whitelisted and will still prompt for confirmation.
   - That Claude Code will apply the new permissions immediately — no restart needed.
