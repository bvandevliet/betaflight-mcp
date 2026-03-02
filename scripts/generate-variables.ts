#!/usr/bin/env tsx
/**
 * Code generation script: fetches the Betaflight CLI.md and generates
 * src/generated/variables.ts with one get_<var> + set_<var> MCP tool pair
 * per CLI variable.
 *
 * Run: pnpm generate
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CLI_MD_URL =
  'https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/development/Cli.md';

interface VarEntry {
  name: string;
  description: string;
  min: string;
  max: string;
  defaultVal: string;
  type: string;
  datatype: string;
}

function sanitizeName(name: string): string {
  // Tool names can contain any characters as strings; no transformation needed
  return name.trim();
}

function buildZodSchema(entry: VarEntry): string {
  const dt = entry.datatype.trim().toUpperCase();
  const min = entry.min.trim();
  const max = entry.max.trim();

  // Check for ON/OFF enum
  if (min === 'OFF' || max === 'ON' || (min === 'OFF' && max === 'ON')) {
    return `z.enum(['OFF', 'ON'])`;
  }

  const minNum = parseFloat(min);
  const maxNum = parseFloat(max);
  const hasRange = !isNaN(minNum) && !isNaN(maxNum);

  if (dt === 'FLOAT') {
    if (hasRange) {
      return `z.number().min(${minNum}).max(${maxNum})`;
    }
    return `z.number()`;
  }

  if (dt === 'UINT8' || dt === 'UINT16' || dt === 'UINT32' || dt === 'INT8' || dt === 'INT16' || dt === 'INT32') {
    if (hasRange) {
      return `z.number().int().min(${minNum}).max(${maxNum})`;
    }
    return `z.number().int()`;
  }

  // Dash or unknown — use string
  return `z.string()`;
}

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

  return `${desc} ${suffix}`.trim();
}

function escapeString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/`/g, '\\`');
}

async function main(): Promise<void> {
  process.stderr.write(`[generate] Fetching ${CLI_MD_URL}\n`);

  let text: string;
  try {
    const resp = await fetch(CLI_MD_URL);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    text = await resp.text();
  } catch (err) {
    process.stderr.write(`[generate] WARNING: Could not fetch CLI.md: ${String(err)}\n`);
    process.stderr.write(`[generate] Generating empty variables file.\n`);
    text = '';
  }

  const entries: VarEntry[] = [];

  if (text) {
    // Find the variable table — header uses backtick-wrapped Variable: | `Variable`
    const tableStart = text.indexOf('| `Variable`');
    if (tableStart === -1) {
      process.stderr.write(`[generate] WARNING: Could not find variable table in CLI.md\n`);
    } else {
      const tableSection = text.slice(tableStart);

      // Row regex: variable cell can be:
      //   | [`name`](/path) |   — markdown link with backtick-wrapped name
      //   | `name` |            — plain backtick-wrapped name
      // Followed by: description | min | max | default | type | datatype |
      const rowRegex =
        /^\|\s*(?:\[)?`([^`]+)`(?:\]\([^)]*\))?\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|/gm;

      let match: RegExpExecArray | null;
      while ((match = rowRegex.exec(tableSection)) !== null) {
        const [, name, description, min, max, defaultVal, type, datatype] = match;
        if (!name || name.trim() === 'Variable') continue; // skip header row
        // Skip separator rows (all dashes)
        if (/^-+$/.test(name.trim())) continue;
        entries.push({
          name: name.trim(),
          description: description?.trim() ?? '',
          min: min?.trim() ?? '-',
          max: max?.trim() ?? '-',
          defaultVal: defaultVal?.trim() ?? '-',
          type: type?.trim() ?? '',
          datatype: datatype?.trim() ?? '',
        });
      }
    }
  }

  process.stderr.write(`[generate] Found ${entries.length} variables\n`);

  const lines: string[] = [];
  lines.push(`// src/generated/variables.ts — DO NOT EDIT — run \`pnpm generate\` to regenerate`);
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';`);
  lines.push(`import { z } from 'zod';`);
  lines.push(`import { requireSession } from '../state.js';`);
  lines.push(``);
  lines.push(`export function registerVariableTools(server: McpServer): void {`);

  if (entries.length === 0) {
    lines.push(`  // No variables found — re-run \`pnpm generate\` when network is available`);
  }

  for (const entry of entries) {
    const toolName = sanitizeName(entry.name);
    const desc = escapeString(buildDescription(entry));
    const zodSchema = buildZodSchema(entry);
    const dt = entry.datatype.trim().toUpperCase();
    const min = entry.min.trim();
    const max = entry.max.trim();

    // Determine value description for set tool
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
  process.stderr.write(`[generate] Written ${outPath} (${entries.length} variables, ${entries.length * 2} tools)\n`);
}

await main();
