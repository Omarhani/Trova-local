import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineConfig, Project } from '@playwright/test';
import { guardExit } from './src/run/exitCrashGuard';
import { retriesFor } from './src/run/retryBook';
import { parseSuite, SuiteBlock } from './src/run/suitePlan';

guardExit(); // read by the run and by each block's process: none of them crashes when it ends (Test 8094 run 616)

/**
 * A TS run is driven by Trova's own suite file (TROVA_SUITE_FILE - the same TestNG XML Trova keeps and the runner
 * writes to suiteFiles/.platform/run-<id>.xml): one project per <test> block, in order, one at a time. Without a
 * suite file only the framework's own unit tests are here.
 */
const suiteFile = process.env.TROVA_SUITE_FILE?.trim();
const results = process.env.TROVA_TS_RESULTS?.trim() || path.join(__dirname, 'target', 'ts-results.json');
/** Omar 2026-11-11: TS runs go side by side in one folder - Playwright empties its output folder at start, so each run has its own */
const runId = process.env.TROVA_RUN_ID?.trim().replace(/[^\w-]/g, '_');

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function project(block: SuiteBlock): Project {
  const methods = block.tests.map((t) => t.method).filter(Boolean);
  return {
    name: block.name,
    testDir: __dirname,
    testMatch: [...new Set(block.tests.map((t) => `**/${t.spec.replace(/\\/g, '/').replace(/^\.?\//, '')}`))],
    // Playwright matches grep against the whole title path ("<file> <title>"): the test's own name ends it
    grep: methods.length ? new RegExp(`(^|\\s)(${methods.map(escape).join('|')})$`) : undefined,
    metadata: { params: block.params, groups: block.groups },
  };
}

/** the run's suite file, read once */
const plan = suiteFile ? parseSuite(fs.readFileSync(suiteFile, 'utf8')) : undefined;

function suiteProjects(): Project[] {
  if (!plan) return [];
  process.env.TROVA_SUITE_NAME ??= plan.name;
  return plan.blocks.filter((b) => b.tests.length > 0).map(project);
}

export default defineConfig({
  workers: 1,
  fullyParallel: false,
  // Round 2: one more try, only for a set-up problem (the reporter decides; a wrong result is never tried again)
  retries: plan ? retriesFor(process.env, plan.params) : 0,
  timeout: 5 * 60_000,
  outputDir: runId ? path.join(__dirname, 'target', 'test-results', `run-${runId}`) : path.join(__dirname, 'target', 'test-results'),
  reporter: [['./src/report/liveReporter.ts'], ['json', { outputFile: results }]],
  // a suite run has only its blocks; without a suite file the framework's own unit tests
  projects: suiteFile ? suiteProjects() : [{ name: 'unit', testDir: './tests/unit' }],
  // the run's one browser and the phone server, each kept for the whole suite like the Java suites (runs 591, 592)
  globalSetup: suiteFile ? require.resolve('./src/run/runSetup') : undefined,
});
