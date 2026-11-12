import * as fs from 'node:fs';
import * as path from 'node:path';
import { projectRoot } from '../run/runDataFile';
import { testData } from '../run/testData';

/**
 * A picture kept with the run: the runner uploads report/<testEnv|stageEnv>/run-<id>/ at the run's end (RunReport), so a
 * failure's last screen reaches Trova with the run. Nothing is written outside a Trova run (no TROVA_RUN_ID).
 */
export function keepWithRun(title: string, png: Buffer): void {
  const runId = process.env.TROVA_RUN_ID?.trim();
  if (!runId) return;
  const env = testData.env();
  const folder = path.join(projectRoot(), 'report', `${env.charAt(0).toLowerCase()}${env.slice(1)}Env`, `run-${runId}`);
  fs.mkdirSync(folder, { recursive: true });
  const name = `${title.replace(/[^\w-]+/g, '_').slice(0, 80)}-last-screen.png`;
  fs.writeFileSync(path.join(folder, name), png);
  console.log(`Last screen kept with the run: report/${name}`);
}
