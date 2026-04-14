#!/usr/bin/env node
// setup.mjs
// Configures the betaflight-mcp MCP server path in the Claude Code plugin.
// Patches both the live plugin/.mcp.json (used by directory-registered plugins
// in Claude Code ≥ 2.1.107) and the plugin cache (used by older versions).
// Usage: node scripts/setup.mjs [path-to-repo]
//        pnpm setup

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const PLACEHOLDER = 'BETAFLIGHT_MCP_SERVER_PATH';

// --- Resolve repo root ---
const serverPath = join(repoRoot, 'dist', 'server.js').replace(/\\/g, '/');

if (!existsSync(serverPath.replace(/\//g, '\\'))) {
  console.error(`ERROR: ${serverPath} not found.`);
  console.error('Run `pnpm build` first, then re-run this script.');
  process.exit(1);
}

console.log(`Server path: ${serverPath}`);

// --- Always patch the live plugin/.mcp.json first (Claude Code ≥ 2.1.107 uses this directly) ---
const liveMcpJson = join(repoRoot, 'plugin', '.mcp.json');
if (existsSync(liveMcpJson)) {
  const liveContent = readFileSync(liveMcpJson, 'utf8');
  if (liveContent.includes(PLACEHOLDER)) {
    writeFileSync(liveMcpJson, liveContent.replaceAll(PLACEHOLDER, serverPath), 'utf8');
    console.log(`Updated live plugin/.mcp.json: ${liveMcpJson}`);
  } else {
    console.log(`Live plugin/.mcp.json already configured: ${liveMcpJson}`);
  }
} else {
  console.warn(`WARNING: plugin/.mcp.json not found at ${liveMcpJson}`);
}

// --- Also patch the plugin cache (Claude Code < 2.1.107 used this) ---
const cacheRoot = join(homedir(), '.claude', 'plugins', 'cache');

if (!existsSync(cacheRoot)) {
  console.error(`ERROR: Plugin cache not found at ${cacheRoot}`);
  console.error('Install the plugin first: /plugin install betaflight-mcp');
  process.exit(1);
}

function findMcpJsonFiles(dir, results = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    try {
      if (statSync(full).isDirectory()) {
        findMcpJsonFiles(full, results);
      } else if (entry === '.mcp.json') {
        results.push(full);
      }
    } catch {
      // skip unreadable entries
    }
  }
  return results;
}

const candidates = findMcpJsonFiles(cacheRoot)
  .filter(f => {
    try { return readFileSync(f, 'utf8').includes(PLACEHOLDER); } catch { return false; }
  });

let target;
if (candidates.length === 0) {
  // Placeholder already replaced or plugin not installed in cache
  const allMcpJson = findMcpJsonFiles(cacheRoot)
    .filter(f => f.replace(/\\/g, '/').includes('betaflight'));
  if (allMcpJson.length > 0) {
    console.log(`Cache placeholder already replaced in: ${allMcpJson[0]}`);
  } else {
    console.log('NOTE: No betaflight .mcp.json found in plugin cache (plugin may not be cache-installed).');
  }
  // Live file was already handled above; nothing more to do for cache.
  console.log('');
  console.log('Restart Claude Code for the MCP server to take effect.');
  console.log('Then say: "Connect to my FPV quad"');
  process.exit(0);
} else if (candidates.length === 1) {
  target = candidates[0];
} else {
  // Prefer the one whose path contains 'betaflight'
  target = candidates.find(f => f.replace(/\\/g, '/').includes('betaflight')) ?? candidates[0];
}

// --- Replace placeholder and write ---
const original = readFileSync(target, 'utf8');
const updated = original.replaceAll(PLACEHOLDER, serverPath);
writeFileSync(target, updated, 'utf8');

console.log(`Updated: ${target}`);
console.log('');
console.log('Restart Claude Code for the MCP server to take effect.');
console.log('Then say: "Connect to my FPV quad');
