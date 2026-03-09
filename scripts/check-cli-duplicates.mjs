#!/usr/bin/env node
// check-cli-duplicates.mjs
// Finds duplicate CLI variable names in development-cli-reference.md.
// Usage: node scripts/check-cli-duplicates.mjs

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const refPath = join(__dirname, '../plugin/skills/betaflight-pid-tuning/references/betaflight-docs/general/development-cli-reference.md');
const ref = readFileSync(refPath, 'utf8');
const lines = ref.split('\n');

// Extract all table rows that look like variable entries.
// Pattern: | `varname` | ... | ... | ... |
// Also support two-column rows (position tables): | `varname` | description |
const varPattern = /^\|\s*`([a-z][a-z0-9_]*)`\s*\|/;

// Track: varname -> array of { lineNum, section, row }
const seen = new Map();
let currentSection = '(preamble)';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Track section headings
  const headingMatch = line.match(/^#+\s+(.+)/);
  if (headingMatch) {
    currentSection = headingMatch[1].trim();
  }

  const m = line.match(varPattern);
  if (!m) continue;

  const varName = m[1];
  if (!seen.has(varName)) {
    seen.set(varName, []);
  }
  seen.get(varName).push({ lineNum: i + 1, section: currentSection, row: line.trim() });
}

// Filter to only duplicates
const dupes = [...seen.entries()].filter(([, hits]) => hits.length > 1);

if (dupes.length === 0) {
  console.log('\n✓ No duplicate CLI variables found.');
  process.exit(0);
}

console.log(`\n=== Duplicate CLI Variables (${dupes.length} found) ===\n`);
for (const [varName, hits] of dupes.sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`  ${varName}  (${hits.length}×)`);
  for (const h of hits) {
    console.log(`    Line ${h.lineNum}  [${h.section}]`);
    console.log(`    ${h.row.slice(0, 120)}${h.row.length > 120 ? '…' : ''}`);
  }
  console.log();
}
console.log(`Total duplicates: ${dupes.length}`);
