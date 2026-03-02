#!/usr/bin/env tsx
/**
 * Code generation script: fetches Betaflight firmware sources and generates
 * src/generated/variables.ts with one get_<var> + set_<var> MCP tool pair
 * per CLI variable.
 *
 * Sources (fetched in parallel):
 *  - parameter_names.h  — resolves PARAM_NAME_* macros → CLI string names
 *  - settings.c         — authoritative variable list (~500 vars), types, ranges
 *  - Cli.md             — ~113 vars with human descriptions and defaults (enrichment)
 *
 * Run: pnpm generate
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CLI_MD_URL =
  'https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/development/Cli.md';

const PARAM_NAMES_URL =
  'https://github.com/betaflight/betaflight/raw/refs/heads/master/src/main/fc/parameter_names.h';

const SETTINGS_C_URL =
  'https://github.com/betaflight/betaflight/raw/refs/heads/master/src/main/cli/settings.c';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface VarEntry {
  name: string;
  description: string;
  min: string;         // numeric string or '-'
  max: string;         // numeric string or '-'
  defaultVal: string;  // from Cli.md or '-'
  type: string;        // "Master" | "Hardware" | "Profile" | "Rate Profile"
  datatype: string;    // "UINT8" | "UINT16" | "UINT32" | "INT8" | "INT16" | "INT32"
  mode: string;        // "LOOKUP" | "BITSET" | "ARRAY" | "STRING" | ""
}

interface CliMdEntry {
  description: string;
  min: string;
  max: string;
  defaultVal: string;
  type: string;
  datatype: string;
}

interface CEntry {
  name: string;
  varType: string;    // "UINT8" | "UINT16" | "UINT32" | "INT8" | "INT16" | "INT32"
  scope: string;      // "MASTER" | "HARDWARE" | "PROFILE" | "RATE_PROFILE"
  modes: string[];    // e.g. ["LOOKUP"] or ["BITSET"] or []
  min?: number;
  max?: number;
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function fetchText(url: string): Promise<string> {
  process.stderr.write(`[generate] Fetching ${url}\n`);
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    return await resp.text();
  } catch (err) {
    process.stderr.write(`[generate] WARNING: Could not fetch ${url}: ${String(err)}\n`);
    return '';
  }
}

// ---------------------------------------------------------------------------
// Step 2 — Parse parameter_names.h
// ---------------------------------------------------------------------------

function parseParameterNames(text: string): Map<string, string> {
  const map = new Map<string, string>();
  // Match: #define PARAM_NAME_FOO "cli_name"
  // Ignore #ifdef context — include all macros unconditionally
  const re = /^#define\s+(PARAM_NAME_\w+)\s+"([^"]+)"/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1] !== undefined && m[2] !== undefined) {
      map.set(m[1], m[2]);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Step 3 — Extract raw entry strings from settings.c valueTable[]
// ---------------------------------------------------------------------------

function extractValueTableEntries(cText: string): string[] {
  // Find the start of the valueTable array
  const markerIdx = cText.indexOf('const clivalue_t valueTable[]');
  if (markerIdx === -1) {
    process.stderr.write('[generate] WARNING: Could not find valueTable[] in settings.c\n');
    return [];
  }

  // Find the opening brace of the array
  let arrayStart = -1;
  for (let i = markerIdx; i < cText.length; i++) {
    if (cText[i] === '{') {
      arrayStart = i;
      break;
    }
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

    // Handle comment entry/exit
    if (!inLineComment && !inBlockComment && ch === '/' && next === '/') {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (!inLineComment && !inBlockComment && ch === '/' && next === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    // Track brace depth
    if (ch === '{') {
      depth++;
      if (depth === 2) {
        entryStart = i;
      }
      i++;
      continue;
    }
    if (ch === '}') {
      if (depth === 2 && entryStart !== -1) {
        entries.push(cText.slice(entryStart, i + 1));
        entryStart = -1;
      }
      depth--;
      i++;
      continue;
    }

    i++;
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Step 4 — Parse a single C entry string into a CEntry
// ---------------------------------------------------------------------------

function parseCEntry(entry: string, paramNames: Map<string, string>): CEntry | null {
  // Resolve name: either a literal string or a PARAM_NAME_* macro
  let name: string | undefined;

  const literalMatch = /^\{\s*"([^"]+)"/.exec(entry);
  if (literalMatch?.[1] !== undefined) {
    name = literalMatch[1];
  } else {
    const macroMatch = /^\{\s*(PARAM_NAME_\w+)/.exec(entry);
    if (macroMatch?.[1] !== undefined) {
      name = paramNames.get(macroMatch[1]);
    }
  }

  if (!name) return null;

  // Var type
  const varTypeMatch = /(VAR_UINT8|VAR_UINT16|VAR_UINT32|VAR_INT8|VAR_INT16|VAR_INT32)/.exec(entry);
  if (!varTypeMatch?.[1]) return null;
  const varType = varTypeMatch[1].replace('VAR_', '');

  // Scope
  let scope = 'MASTER';
  if (/HARDWARE_VALUE/.test(entry)) {
    scope = 'HARDWARE';
  } else if (/PROFILE_RATE_VALUE/.test(entry)) {
    scope = 'RATE_PROFILE';
  } else if (/PROFILE_VALUE/.test(entry)) {
    scope = 'PROFILE';
  }

  // Modes
  const modes: string[] = [];
  if (/MODE_LOOKUP/.test(entry))  modes.push('LOOKUP');
  if (/MODE_BITSET/.test(entry))  modes.push('BITSET');
  if (/MODE_ARRAY/.test(entry))   modes.push('ARRAY');
  if (/MODE_STRING/.test(entry))  modes.push('STRING');

  // Range from .config.minmax = { min, max }
  let min: number | undefined;
  let max: number | undefined;

  const minmaxMatch = /\.config\.minmax\s*=\s*\{\s*(-?\d+)\s*,\s*(-?\d+)\s*\}/.exec(entry);
  if (minmaxMatch?.[1] !== undefined && minmaxMatch[2] !== undefined) {
    min = parseInt(minmaxMatch[1], 10);
    max = parseInt(minmaxMatch[2], 10);
  } else {
    const unsignedMatch = /\.config\.minmaxUnsigned\s*=\s*\{\s*(\d+)\s*,\s*(\d+)\s*\}/.exec(entry);
    if (unsignedMatch?.[1] !== undefined && unsignedMatch[2] !== undefined) {
      min = parseInt(unsignedMatch[1], 10);
      max = parseInt(unsignedMatch[2], 10);
    } else {
      const u32Match = /\.config\.u32Max\s*=\s*(\d+)/.exec(entry);
      if (u32Match?.[1] !== undefined) {
        min = 0;
        max = parseInt(u32Match[1], 10);
      }
    }
  }

  const result: CEntry = { name, varType, scope, modes };
  if (min !== undefined) result.min = min;
  if (max !== undefined) result.max = max;
  return result;
}

// ---------------------------------------------------------------------------
// Step 5 — Parse Cli.md into a Map
// ---------------------------------------------------------------------------

function parseCliMd(text: string): Map<string, CliMdEntry> {
  const map = new Map<string, CliMdEntry>();
  if (!text) return map;

  const tableStart = text.indexOf('| `Variable`');
  if (tableStart === -1) {
    process.stderr.write('[generate] WARNING: Could not find variable table in Cli.md\n');
    return map;
  }

  const tableSection = text.slice(tableStart);
  const rowRegex =
    /^\|\s*(?:\[)?`([^`]+)`(?:\]\([^)]*\))?\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|/gm;

  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(tableSection)) !== null) {
    const [, name, description, min, max, defaultVal, type, datatype] = match;
    if (!name || name.trim() === 'Variable') continue;
    if (/^-+$/.test(name.trim())) continue;

    map.set(name.trim(), {
      description: description?.trim() ?? '',
      min: min?.trim() ?? '-',
      max: max?.trim() ?? '-',
      defaultVal: defaultVal?.trim() ?? '-',
      type: type?.trim() ?? '',
      datatype: datatype?.trim() ?? '',
    });
  }

  return map;
}

// ---------------------------------------------------------------------------
// Step 6 — Build VarEntry list from C entries (with Cli.md enrichment)
// ---------------------------------------------------------------------------

const SCOPE_LABELS: Record<string, string> = {
  MASTER:      'Master',
  HARDWARE:    'Hardware',
  PROFILE:     'Profile',
  RATE_PROFILE: 'Rate Profile',
};

function buildVarEntries(cEntries: CEntry[], cliMd: Map<string, CliMdEntry>): VarEntry[] {
  const seen = new Set<string>();
  const entries: VarEntry[] = [];

  for (const cEntry of cEntries) {
    if (seen.has(cEntry.name)) continue;
    seen.add(cEntry.name);

    const cli = cliMd.get(cEntry.name);
    const mode = cEntry.modes[0] ?? '';

    entries.push({
      name:        cEntry.name,
      description: cli?.description ?? '',
      defaultVal:  cli?.defaultVal ?? '-',
      type:        SCOPE_LABELS[cEntry.scope] ?? 'Master',
      datatype:    cEntry.varType,
      min:         cEntry.min !== undefined ? String(cEntry.min) : '-',
      max:         cEntry.max !== undefined ? String(cEntry.max) : '-',
      mode,
    });
  }

  return entries;
}


// ---------------------------------------------------------------------------
// Step 7 — Build Zod schema string
// ---------------------------------------------------------------------------

function buildZodSchema(entry: VarEntry): string {
  if (entry.mode === 'LOOKUP') return `z.string()`;
  if (entry.mode === 'BITSET') return `z.enum(['OFF', 'ON'])`;
  if (entry.mode === 'ARRAY')  return `z.string()`;
  if (entry.mode === 'STRING') return `z.string()`;

  // ON/OFF detection (Cli.md-described vars with string min/max)
  const min = entry.min.trim();
  const max = entry.max.trim();
  if (min === 'OFF' || max === 'ON' || (min === 'OFF' && max === 'ON')) {
    return `z.enum(['OFF', 'ON'])`;
  }

  const dt = entry.datatype.trim().toUpperCase();
  const minNum = parseFloat(min);
  const maxNum = parseFloat(max);
  const hasRange = !isNaN(minNum) && !isNaN(maxNum);

  if (dt === 'FLOAT') {
    return hasRange ? `z.number().min(${minNum}).max(${maxNum})` : `z.number()`;
  }

  if (['UINT8', 'UINT16', 'UINT32', 'INT8', 'INT16', 'INT32'].includes(dt)) {
    return hasRange ? `z.number().int().min(${minNum}).max(${maxNum})` : `z.number().int()`;
  }

  return `z.string()`;
}

// ---------------------------------------------------------------------------
// Step 8 — Build description string
// ---------------------------------------------------------------------------

function buildDescription(entry: VarEntry): string {
  const dt = entry.datatype.trim();
  const min = entry.min.trim();
  const max = entry.max.trim();
  const def = entry.defaultVal.trim();
  const desc = entry.description.trim();

  let suffix = `[${dt}`;
  if (min && max && min !== '-' && max !== '-') {
    suffix += `, ${min}–${max}`;
  }
  if (def && def !== '-') {
    suffix += `, default: ${def}`;
  }
  suffix += ']';

  return desc ? `${desc} ${suffix}` : suffix;
}

function escapeString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/`/g, '\\`');
}

function sanitizeName(name: string): string {
  return name.trim();
}

// ---------------------------------------------------------------------------
// Step 9 — main()
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Fetch all three sources in parallel
  const [cText, headerText, cliMdText] = await Promise.all([
    fetchText(SETTINGS_C_URL),
    fetchText(PARAM_NAMES_URL),
    fetchText(CLI_MD_URL),
  ]);

  const paramNames = parseParameterNames(headerText);
  process.stderr.write(`[generate] Resolved ${paramNames.size} PARAM_NAME_* macros\n`);

  const rawCEntryStrings = extractValueTableEntries(cText);
  process.stderr.write(`[generate] Extracted ${rawCEntryStrings.length} raw entries from settings.c\n`);

  const rawCEntries = rawCEntryStrings
    .map(e => parseCEntry(e, paramNames))
    .filter((e): e is CEntry => e !== null);
  process.stderr.write(`[generate] Parsed ${rawCEntries.length} valid C entries\n`);

  const cliMd = parseCliMd(cliMdText);
  process.stderr.write(`[generate] Parsed ${cliMd.size} Cli.md entries\n`);

  if (rawCEntries.length === 0) {
    process.stderr.write(
      '[generate] ERROR: No variables parsed from settings.c — firmware source is the required source of truth.\n' +
      '[generate] Check network connectivity and re-run `pnpm generate`.\n'
    );
    process.exit(1);
  }

  const entries = buildVarEntries(rawCEntries, cliMd);
  process.stderr.write(`[generate] Found ${entries.length} variables\n`);

  // ---------------------------------------------------------------------------
  // Emit generated TypeScript
  // ---------------------------------------------------------------------------

  const lines: string[] = [];
  lines.push(`// src/generated/variables.ts — DO NOT EDIT — run \`pnpm generate\` to regenerate`);
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push(`// Source: settings.c (${rawCEntries.length} entries) + Cli.md (${cliMd.size} descriptions)`);
  lines.push(``);
  lines.push(`import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';`);
  lines.push(`import { z } from 'zod';`);
  lines.push(`import { requireSession } from '../state.js';`);
  lines.push(``);
  lines.push(`export function registerVariableTools(server: McpServer): void {`);

  for (const entry of entries) {
    const toolName = sanitizeName(entry.name);
    const desc = escapeString(buildDescription(entry));
    const zodSchema = buildZodSchema(entry);
    const dt = entry.datatype.trim().toUpperCase();
    const min = entry.min.trim();
    const max = entry.max.trim();

    let rangeDesc = dt;
    if (min !== '-' && max !== '-' && min !== '' && max !== '') {
      rangeDesc += `, ${min}–${max}`;
    }

    lines.push(``);
    lines.push(`  // ${toolName} — ${entry.type.trim()} — ${dt}`);
    lines.push(`  server.registerTool(`);
    lines.push(`    'get_${toolName}',`);
    lines.push(`    { description: 'Get ${toolName}: ${desc}' },`);
    lines.push(`    async () => {`);
    lines.push(`      const session = requireSession();`);
    lines.push(`      const result = await session.cliClient.execCommand('get ${toolName}');`);
    lines.push(`      return { content: [{ type: 'text' as const, text: result }] };`);
    lines.push(`    }`);
    lines.push(`  );`);
    lines.push(`  server.registerTool(`);
    lines.push(`    'set_${toolName}',`);
    lines.push(`    {`);
    lines.push(`      description: 'Set ${toolName}: ${desc}',`);
    lines.push(`      inputSchema: { value: ${zodSchema}.describe('Value for ${toolName} (${escapeString(rangeDesc)})') },`);
    lines.push(`    },`);
    lines.push(`    async ({ value }) => {`);
    lines.push(`      const session = requireSession();`);
    lines.push(`      const result = await session.cliClient.execCommand(\`set ${toolName}=\${String(value)}\`);`);
    lines.push(`      return { content: [{ type: 'text' as const, text: result || 'OK' }] };`);
    lines.push(`    }`);
    lines.push(`  );`);
  }

  lines.push(`}`);
  lines.push(``);

  const outPath = join(__dirname, '..', 'src', 'generated', 'variables.ts');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, lines.join('\n'), 'utf-8');
  process.stderr.write(
    `[generate] Written ${outPath} (${entries.length} variables, ${entries.length * 2} tools)\n`
  );
}

await main();
