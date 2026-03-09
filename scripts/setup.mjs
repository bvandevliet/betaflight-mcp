#!/usr/bin/env node
// setup.mjs
// Configures the betaflight-mcp MCP server path in the Claude Code plugin cache.
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

// --- Find cached .mcp.json ---
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
  // Placeholder already replaced or plugin not installed
  const allMcpJson = findMcpJsonFiles(cacheRoot)
    .filter(f => f.replace(/\\/g, '/').includes('betaflight'));
  if (allMcpJson.length > 0) {
    target = allMcpJson[0];
    const current = readFileSync(target, 'utf8');
    console.log(`Placeholder already replaced in: ${target}`);
    console.log(`Current content:\n${current}`);
    console.log('\nTo reconfigure, manually restore the placeholder or reinstall the plugin.');
    process.exit(0);
  }
  console.error(`ERROR: No cached .mcp.json containing "${PLACEHOLDER}" found in ${cacheRoot}`);
  console.error('Install the plugin first: /plugin install betaflight-mcp');
  process.exit(1);
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
