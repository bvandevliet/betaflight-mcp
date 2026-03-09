#!/usr/bin/env tsx
/**
 * Audit script: compares CLI variables in the local development-cli-reference.md
 * against the authoritative upstream firmware source (settings.c + parameter_names.h).
 *
 * Outputs:
 *   - Variables in the doc but NOT in firmware  → candidates for removal
 *   - Variables in firmware but NOT in the doc  → candidates for addition
 *
 * Run: pnpm tsx scripts/audit-cli-reference.ts
 * Run with --fix to remove obsolete variables from the doc in-place.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LOCAL_CLI_REF_PATH = join(
  __dirname,
  '../plugin/skills/betaflight-pid-tuning/references/betaflight-docs/general/development-cli-reference.md'
);

// Use a specific release tag to match the documented firmware version.
// Override with: BETAFLIGHT_REF=master pnpm tsx scripts/audit-cli-reference.ts
const BF_REF = process.env['BETAFLIGHT_REF'] ?? '2025.12.2';
const BF_BASE = `https://github.com/betaflight/betaflight/raw/refs/tags/${BF_REF}`;

const PARAM_NAMES_URL = `${BF_BASE}/src/main/fc/parameter_names.h`;
const SETTINGS_C_URL  = `${BF_BASE}/src/main/cli/settings.c`;

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function fetchText(url: string): Promise<string> {
  process.stderr.write(`[audit] Fetching ${url}\n`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText} — ${url}`);
  return resp.text();
}

// ---------------------------------------------------------------------------
// Parse parameter_names.h → Map<macro, cli_name>
// ---------------------------------------------------------------------------

function parseParameterNames(text: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /^#define\s+(PARAM_NAME_\w+)\s+"([^"]+)"/gm;
  for (const m of text.matchAll(re)) {
    if (m[1] !== undefined && m[2] !== undefined) map.set(m[1], m[2]);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Extract raw entry strings from settings.c valueTable[]
// ---------------------------------------------------------------------------

function extractValueTableEntries(cText: string): string[] {
  const markerIdx = cText.indexOf('const clivalue_t valueTable[]');
  if (markerIdx === -1) return [];

  let arrayStart = -1;
  for (let i = markerIdx; i < cText.length; i++) {
    if (cText[i] === '{') { arrayStart = i; break; }
  }
  if (arrayStart === -1) return [];

  const entries: string[] = [];
  let depth = 1;
  let i = arrayStart + 1;
  let entryStart = -1;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < cText.length && depth > 0) {
    const ch = cText[i];
    const next = cText[i + 1];

    if (!inLineComment && !inBlockComment && ch === '/' && next === '/') {
      inLineComment = true; i += 2; continue;
    }
    if (!inLineComment && !inBlockComment && ch === '/' && next === '*') {
      inBlockComment = true; i += 2; continue;
    }
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      i++; continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i += 2; }
      else i++;
      continue;
    }

    if (ch === '{') {
      depth++;
      if (depth === 2) entryStart = i;
      i++; continue;
    }
    if (ch === '}') {
      if (depth === 2 && entryStart !== -1) {
        entries.push(cText.slice(entryStart, i + 1));
        entryStart = -1;
      }
      depth--; i++; continue;
    }
    i++;
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Parse a single C entry → variable name (or null)
// ---------------------------------------------------------------------------

function parseCEntryName(entry: string, paramNames: Map<string, string>): string | null {
  const literalMatch = /^\{\s*"([^"]+)"/.exec(entry);
  if (literalMatch?.[1] !== undefined) return literalMatch[1];

  const macroMatch = /^\{\s*(PARAM_NAME_\w+)/.exec(entry);
  if (macroMatch?.[1] !== undefined) return paramNames.get(macroMatch[1]) ?? null;

  return null;
}

// ---------------------------------------------------------------------------
// Parse CLI reference doc → Set of variable names
// ---------------------------------------------------------------------------

function parseDocVarNames(text: string): Set<string> {
  const names = new Set<string>();
  // Match 4-column variable table rows: | `varname` | default | range | description |
  // (?:[^|\n]*\|){3} requires exactly 3 more pipe-separated columns on the same line,
  // distinguishing variable rows (4 columns) from command table rows (2 columns).
  const re = /^\|[ \t]*`([a-z][a-z0-9_]+)`[ \t]*\|(?:[^|\n]*\|){3}/gm;
  for (const m of text.matchAll(re)) {
    if (m[1] !== undefined) names.add(m[1]);
  }
  return names;
}

// ---------------------------------------------------------------------------
// Remove obsolete variable rows from the doc text
// ---------------------------------------------------------------------------

function removeObsoleteRows(docText: string, toRemove: Set<string>): string {
  if (toRemove.size === 0) return docText;

  const lines = docText.split('\n');
  const kept: string[] = [];

  for (const line of lines) {
    const m = /^\|[ \t]*`([a-z][a-z0-9_]+)`[ \t]*\|(?:[^|\n]*\|){3}/.exec(line);
    if (m?.[1] !== undefined && toRemove.has(m[1])) continue;
    kept.push(line);
  }

  return kept.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');

  const [cText, headerText] = await Promise.all([
    fetchText(SETTINGS_C_URL),
    fetchText(PARAM_NAMES_URL),
  ]);

  const paramNames = parseParameterNames(headerText);
  process.stderr.write(`[audit] Resolved ${paramNames.size} PARAM_NAME_* macros\n`);

  const rawEntries = extractValueTableEntries(cText);
  process.stderr.write(`[audit] Extracted ${rawEntries.length} raw entries from settings.c\n`);

  // Firmware variable set (deduplicated)
  const firmwareVars = new Set<string>();
  for (const entry of rawEntries) {
    const name = parseCEntryName(entry, paramNames);
    if (name) firmwareVars.add(name);
  }
  process.stderr.write(`[audit] ${firmwareVars.size} unique variables in firmware\n`);

  if (firmwareVars.size === 0) {
    process.stderr.write('[audit] ERROR: No variables found in firmware — check connectivity.\n');
    process.exit(1);
  }

  const docText = readFileSync(LOCAL_CLI_REF_PATH, 'utf-8');
  const docVars = parseDocVarNames(docText);
  process.stderr.write(`[audit] ${docVars.size} variables in CLI reference doc\n`);

  // Diff
  const obsolete = new Set<string>(); // in doc, not in firmware
  const missing  = new Set<string>(); // in firmware, not in doc

  for (const name of docVars) {
    if (!firmwareVars.has(name)) obsolete.add(name);
  }
  for (const name of firmwareVars) {
    if (!docVars.has(name)) missing.add(name);
  }

  // Report
  console.log('\n=== CLI REFERENCE AUDIT ===\n');
  console.log(`Firmware variables  : ${firmwareVars.size}`);
  console.log(`Doc variables       : ${docVars.size}`);
  console.log(`Obsolete (in doc, not firmware) : ${obsolete.size}`);
  console.log(`Missing  (in firmware, not doc) : ${missing.size}`);

  if (obsolete.size > 0) {
    console.log('\n--- OBSOLETE (remove from doc) ---');
    for (const name of [...obsolete].sort()) {
      console.log(`  - ${name}`);
    }
  }

  if (missing.size > 0) {
    console.log('\n--- MISSING (add to doc) ---');
    for (const name of [...missing].sort()) {
      console.log(`  + ${name}`);
    }
  }

  if (fix) {
    if (obsolete.size === 0) {
      console.log('\n[fix] Nothing to remove.');
    } else {
      const fixed = removeObsoleteRows(docText, obsolete);
      writeFileSync(LOCAL_CLI_REF_PATH, fixed, 'utf-8');
      console.log(`\n[fix] Removed ${obsolete.size} obsolete variable rows from doc.`);
    }
  } else if (obsolete.size > 0 || missing.size > 0) {
    console.log('\nRun with --fix to remove obsolete rows from the doc.');
  }

  console.log('\n=== DONE ===\n');
}

await main();
