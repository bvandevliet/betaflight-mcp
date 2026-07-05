#!/usr/bin/env tsx
/**
 * Automated eval runner for plugin/skills/betaflight-pid-tuning/evals/evals.json.
 *
 * Loads SKILL.md as the system prompt, sends each eval's prompt to a "skill model"
 * (Claude), then asks a "judge model" to score each of the eval's natural-language
 * assertions against the response. Exits 1 if any assertion fails (CI-friendly).
 *
 * Scope note: only SKILL.md is loaded as system prompt, not the reference/*.md files
 * under references/ — SKILL.md itself instructs progressive disclosure ("trust
 * inline content, load references only when needed"), and the current eval set only
 * exercises inline knowledge. references/ totals ~700KB (cli-reference.md, tuning
 * notes, youtube summaries) — loading all of it unconditionally on every eval run
 * would blow both the context window and the per-run cost for no benefit against
 * the current assertions. If a future eval needs reference-file-dependent behaviour,
 * extend the eval case with an explicit `references: string[]` field and load only
 * those files rather than dumping everything.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... pnpm tsx scripts/run-evals.ts
 *   pnpm tsx scripts/run-evals.ts --ids 1 3 5
 *   pnpm tsx scripts/run-evals.ts --verbose
 *   pnpm tsx scripts/run-evals.ts --skill-model claude-opus-4-8 --judge-model claude-haiku-4-5-20251001
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SKILL_MD_PATH = join(__dirname, '../plugin/skills/betaflight-pid-tuning/SKILL.md');
const EVALS_JSON_PATH = join(__dirname, '../plugin/skills/betaflight-pid-tuning/evals/evals.json');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Overridable via --skill-model/--judge-model or EVAL_SKILL_MODEL/EVAL_JUDGE_MODEL.
// Defaults picked for a strong-but-cheap split: full model to run the skill,
// small fast model to grade it.
const DEFAULT_SKILL_MODEL = process.env['EVAL_SKILL_MODEL'] ?? 'claude-sonnet-5';
const DEFAULT_JUDGE_MODEL = process.env['EVAL_JUDGE_MODEL'] ?? 'claude-haiku-4-5-20251001';

interface EvalCase {
  id: number;
  prompt: string;
  expected_output: string;
  files: string[];
  assertions: string[];
}

interface EvalsFile {
  skill_name: string;
  evals: EvalCase[];
}

interface AssertionResult {
  index: number;
  assertion: string;
  pass: boolean;
  reason: string;
}

// ---------------------------------------------------------------------------
// Anthropic Messages API — plain fetch, no SDK dependency (matches this repo's
// existing scripts/*.ts convention of using global fetch directly).
// ---------------------------------------------------------------------------

async function callClaude(
  apiKey: string,
  model: string,
  system: string,
  userContent: string,
  maxTokens: number
): Promise<string> {
  const resp = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Anthropic API ${resp.status}: ${resp.statusText} — ${body}`);
  }

  const data = (await resp.json()) as { content: { type: string; text?: string }[] };
  const text = data.content
    .filter((block) => block.type === 'text' && block.text !== undefined)
    .map((block) => block.text)
    .join('');

  if (!text) throw new Error('Anthropic API returned no text content');
  return text;
}

// ---------------------------------------------------------------------------
// Judge: ask the judge model to score each assertion against the skill response.
// ---------------------------------------------------------------------------

const JUDGE_SYSTEM_PROMPT = `You are a strict grader for a Claude Agent Skill's responses.

You will receive:
1. The original user prompt sent to the skill
2. The skill's response
3. A numbered list of assertions the response should satisfy

For each assertion, decide PASS or FAIL based only on whether the response satisfies it — do not
be lenient. A vague or generic statement that doesn't specifically address the assertion is a FAIL.

Respond with ONLY a JSON object, no prose, no markdown fences:
{"results": [{"index": 0, "pass": true, "reason": "one sentence"}, ...]}

The "index" values must match the 0-based position of each assertion in the list you were given.`;

function extractJson(text: string): string {
  // Judge models sometimes wrap JSON in a code fence despite instructions not to.
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fenced?.[1] !== undefined) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Judge response contained no JSON object: ${text.slice(0, 200)}`);
  }
  return text.slice(start, end + 1);
}

async function judgeAssertions(
  apiKey: string,
  judgeModel: string,
  evalCase: EvalCase,
  skillResponse: string
): Promise<AssertionResult[]> {
  const assertionList = evalCase.assertions.map((a, i) => `${i}. ${a}`).join('\n');
  const userContent = [
    `## Original prompt\n${evalCase.prompt}`,
    `## Skill response\n${skillResponse}`,
    `## Assertions to check\n${assertionList}`,
  ].join('\n\n');

  const judgeText = await callClaude(apiKey, judgeModel, JUDGE_SYSTEM_PROMPT, userContent, 2048);
  const parsed = JSON.parse(extractJson(judgeText)) as {
    results: { index: number; pass: boolean; reason: string }[];
  };

  return parsed.results.map((r) => ({
    index: r.index,
    assertion: evalCase.assertions[r.index] ?? '(unknown assertion index)',
    pass: r.pass,
    reason: r.reason,
  }));
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface Args {
  ids: number[] | null;
  verbose: boolean;
  skillModel: string;
  judgeModel: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    ids: null,
    verbose: false,
    skillModel: DEFAULT_SKILL_MODEL,
    judgeModel: DEFAULT_JUDGE_MODEL,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--verbose') {
      args.verbose = true;
    } else if (arg === '--skill-model') {
      args.skillModel = argv[++i] ?? args.skillModel;
    } else if (arg === '--judge-model') {
      args.judgeModel = argv[++i] ?? args.judgeModel;
    } else if (arg === '--ids') {
      const ids: number[] = [];
      while (argv[i + 1] !== undefined && /^\d+$/.test(argv[i + 1] as string)) {
        ids.push(parseInt(argv[++i] as string, 10));
      }
      args.ids = ids;
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    process.stderr.write('ERROR: ANTHROPIC_API_KEY is not set.\n');
    process.exit(1);
  }

  const skillMd = readFileSync(SKILL_MD_PATH, 'utf-8');
  const evalsFile = JSON.parse(readFileSync(EVALS_JSON_PATH, 'utf-8')) as EvalsFile;

  const casesToRun = args.ids
    ? evalsFile.evals.filter((e) => args.ids?.includes(e.id))
    : evalsFile.evals;

  if (casesToRun.length === 0) {
    process.stderr.write('No matching eval cases found.\n');
    process.exit(1);
  }

  process.stderr.write(
    `[run-evals] Running ${casesToRun.length} eval(s) — skill=${args.skillModel} judge=${args.judgeModel}\n`
  );

  let anyFailed = false;

  for (const evalCase of casesToRun) {
    process.stderr.write(`\n=== Eval ${evalCase.id} ===\n`);

    let skillResponse: string;
    try {
      skillResponse = await callClaude(apiKey, args.skillModel, skillMd, evalCase.prompt, 2048);
    } catch (err) {
      anyFailed = true;
      console.log(`Eval ${evalCase.id}: ERROR calling skill model — ${(err as Error).message}`);
      continue;
    }

    if (args.verbose) {
      process.stderr.write(`--- skill response ---\n${skillResponse}\n--- end response ---\n`);
    }

    let results: AssertionResult[];
    try {
      results = await judgeAssertions(apiKey, args.judgeModel, evalCase, skillResponse);
    } catch (err) {
      anyFailed = true;
      console.log(`Eval ${evalCase.id}: ERROR calling judge model — ${(err as Error).message}`);
      continue;
    }

    const passed = results.filter((r) => r.pass).length;
    const total = results.length;
    const evalPassed = passed === total;
    if (!evalPassed) anyFailed = true;

    console.log(`Eval ${evalCase.id}: ${evalPassed ? 'PASS' : 'FAIL'} (${passed}/${total} assertions)`);
    for (const r of results) {
      const mark = r.pass ? 'PASS' : 'FAIL';
      console.log(`  [${mark}] ${r.assertion}`);
      if (!r.pass || args.verbose) console.log(`         ${r.reason}`);
    }
  }

  process.stderr.write(`\n[run-evals] ${anyFailed ? 'FAILED' : 'ALL PASSED'}\n`);
  process.exit(anyFailed ? 1 : 0);
}

await main();
