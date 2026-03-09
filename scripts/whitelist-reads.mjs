#!/usr/bin/env node
// whitelist-reads.mjs
// Adds all betaflight-mcp read-only tools to ~/.claude/settings.json permissions.allow.
// Usage: node scripts/whitelist-reads.mjs
//        pnpm whitelist-reads

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const PLUGIN_PREFIX = 'mcp__plugin_betaflight-mcp_betaflight__';
const STALE_WILDCARD = `${PLUGIN_PREFIX}get_*`;
const VARIABLES_TS = join(REPO_ROOT, 'src', 'generated', 'variables.ts');
const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');

// Fixed read-only tools that aren't generated from variables.ts
const FIXED_TOOLS = [
  'list_serial_ports',
  'preflight_check',
  'get_pid_sliders',
  'get_aux_config',
  'get_channel_map',
  'get_mixer',
  'get_serial_config',
  'get_tasks',
  'get_version',
  'get_status',
  'get_raw_imu',
  'get_attitude',
  'get_altitude',
  'get_battery',
  'get_battery_state',
  'get_rc_channels',
  'get_gps_data',
  'get_motor_values',
  'motor_get',
  'feature_list',
  'cli_status',
  'cli_help',
  'cli_diff',
  'cli_dump',
  'get_dataflash_summary',
  'get_arming_disable_flags',
  'get_current_profile',
];

// Extract get_* tool names from generated variables.ts
let variableTools = [];
if (existsSync(VARIABLES_TS)) {
  const src = readFileSync(VARIABLES_TS, 'utf8');
  const matches = [...src.matchAll(/registerTool\(\s*'(get_[^']+)'/g)];
  variableTools = [...new Set(matches.map(m => m[1]))];
  console.log(`Found ${variableTools.length} get_* variable tools in variables.ts`);
} else {
  console.warn(`WARNING: ${VARIABLES_TS} not found.`);
  console.warn('Run `pnpm generate` first to generate the variables file.');
  console.warn('Only the fixed tool list will be added.\n');
}

// Build full allow-list (prefix all names)
const allTools = [...new Set([...FIXED_TOOLS, ...variableTools])]
  .map(name => `${PLUGIN_PREFIX}${name}`);

// Read current settings
let settings = {};
if (existsSync(SETTINGS_PATH)) {
  settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
} else {
  mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
}

// Ensure permissions.allow array exists
settings.permissions ??= {};
settings.permissions.allow ??= [];

// Remove stale wildcard entry (silently ignored by Claude Code, misleading)
const beforeCount = settings.permissions.allow.length;
settings.permissions.allow = settings.permissions.allow.filter(e => e !== STALE_WILDCARD);
const removedWildcard = beforeCount > settings.permissions.allow.length;

// Add missing entries
const existing = new Set(settings.permissions.allow);
const toAdd = allTools.filter(t => !existing.has(t));
settings.permissions.allow.push(...toAdd);

// Write back
writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf8');

// Summary
if (removedWildcard) {
  console.log('Removed stale get_* wildcard (not supported by Claude Code).');
}
if (toAdd.length > 0) {
  console.log(`Added ${toAdd.length} entries to permissions.allow.`);
} else {
  console.log('All entries already present — nothing to add.');
}
console.log(`Total betaflight read-only tools allowed: ${allTools.length}`);
console.log(`Settings: ${SETTINGS_PATH}`);
console.log('');
console.log('Write tools (set_*, cli_save, cli_exec, motor_set, etc.) are NOT whitelisted.');
console.log('Claude Code applies updated permissions immediately.');
