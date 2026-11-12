import * as fs from 'node:fs';
import * as path from 'node:path';

/** what the run's pre-run check stopped: the app's server (every case) or the phone (phone cases), each with one reason */
export interface Stops {
  app?: string;
  phone?: string;
}

/** <automation-ts>/target/run-stops-<run>.json (git-ignored), 'local' outside a Trova run */
export function runStopsFile(env: NodeJS.ProcessEnv = process.env): string {
  const run = (env.TROVA_RUN_ID?.trim() || 'local').replace(/[^\w-]/g, '_');
  return path.resolve(__dirname, '..', '..', 'target', `run-stops-${run}.json`);
}

/** Round 2: the pre-run check's stops, written once by the run's set-up and read by every block's own process */
export class RunStops {
  constructor(private readonly file: () => string = () => runStopsFile()) {}

  save(stops: Stops): void {
    const file = this.file();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(stops));
  }

  read(): Stops {
    try {
      return JSON.parse(fs.readFileSync(this.file(), 'utf8')) as Stops;
    } catch {
      return {};
    }
  }

  forget(): void {
    fs.rmSync(this.file(), { force: true });
  }
}

export const runStops = new RunStops();
