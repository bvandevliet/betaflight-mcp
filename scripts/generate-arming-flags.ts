#!/usr/bin/env tsx
/**
 * Code generation script: fetches Betaflight's runtime_config.h and generates
 * src/generated/armingFlags.ts — an array of arming-disable flag names indexed
 * by bit position.
 *
 * The armingDisableFlags_e enum is NOT a stable hand-maintained list: bit
 * positions, names, and total flag count have all changed across firmware
 * versions (e.g. ARMING_DISABLED_NOT_DISARMED was inserted at bit 3, and
 * ARMING_DISABLED_CRASHFLIP/ALTHOLD/POSHOLD were added at the tail for
 * fixed-wing/poshold/crashflip features). A hand-typed array silently goes
 * stale and misreports flags. Each enum member sets its bit explicitly via
 * `(1 << N)`, so we parse that literal rather than relying on declaration
 * order.
 *
 * Source:
 *  - runtime_config.h — armingDisableFlags_e enum (fetched)
 *
 * Run: pnpm generate
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RUNTIME_CONFIG_H_URL =
  'https://github.com/betaflight/betaflight/raw/refs/heads/master/src/main/fc/runtime_config.h';

const OUTPUT_PATH = join(__dirname, '../src/generated/armingFlags.ts');

async function fetchText(url: string): Promise<string> {
  process.stderr.write(`[generate-arming-flags] Fetching ${url}\n`);
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  }
  return await resp.text();
}

// Parses entries like:
//   ARMING_DISABLED_NOT_DISARMED    = (1 << 3),
// from the armingDisableFlags_e enum block specifically (delimited by the
// preceding `typedef enum {` and the `} armingDisableFlags_e;` terminator),
// so we don't accidentally match bit-shift enums from unrelated typedefs in
// the same file (e.g. flightModeFlags_e).
function parseArmingDisableFlags(text: string): string[] {
  const enumEndIdx = text.indexOf('} armingDisableFlags_e;');
  if (enumEndIdx === -1) {
    throw new Error('Could not find "} armingDisableFlags_e;" terminator in runtime_config.h');
  }

  const enumStartIdx = text.lastIndexOf('typedef enum {', enumEndIdx);
  if (enumStartIdx === -1) {
    throw new Error('Could not find start of armingDisableFlags_e enum block');
  }

  const block = text.slice(enumStartIdx, enumEndIdx);
  const re = /ARMING_DISABLED_(\w+)\s*=\s*\(\s*1\s*<<\s*(\d+)\s*\)/g;

  const byBit = new Map<number, string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const name = m[1];
    const bit = m[2];
    if (name === undefined || bit === undefined) continue;
    byBit.set(parseInt(bit, 10), name);
  }

  if (byBit.size === 0) {
    throw new Error('Parsed zero ARMING_DISABLED_* entries — regex or markers may be stale');
  }

  const maxBit = Math.max(...byBit.keys());
  const flags: string[] = [];
  for (let bit = 0; bit <= maxBit; bit++) {
    const name = byBit.get(bit);
    if (name === undefined) {
      throw new Error(`Gap at bit ${bit} — armingDisableFlags_e is not densely packed from 0`);
    }
    flags.push(name);
  }
  return flags;
}

async function main() {
  const text = await fetchText(RUNTIME_CONFIG_H_URL);
  const flags = parseArmingDisableFlags(text);
  process.stderr.write(`[generate-arming-flags] Parsed ${flags.length} flags (bits 0-${flags.length - 1})\n`);

  const lines: string[] = [];
  lines.push('// src/generated/armingFlags.ts — DO NOT EDIT — run `pnpm generate` to regenerate');
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push('// Source: runtime_config.h armingDisableFlags_e enum (parsed by explicit (1 << N) bit value,');
  lines.push('// not declaration order, so additions/reorders across firmware versions stay correct).');
  lines.push('');
  lines.push('// Arming-disable flag names indexed by bit position. Index i corresponds to bit (1 << i)');
  lines.push('// in the armingDisableFlags bitmask returned by MSP_STATUS_EX.');
  lines.push('export const ARMING_DISABLE_FLAGS: readonly string[] = [');
  for (const name of flags) {
    lines.push(`  '${name}',`);
  }
  lines.push('];');
  lines.push('');

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf-8');
  process.stderr.write(`[generate-arming-flags] Wrote ${OUTPUT_PATH}\n`);
}

main().catch((err) => {
  process.stderr.write(`[generate-arming-flags] ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
