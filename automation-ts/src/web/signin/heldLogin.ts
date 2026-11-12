import * as fs from 'node:fs';
import * as path from 'node:path';

/** which login the run's one browser holds now - a file, because the blocks run in worker processes one after another */
const HOLDS = path.resolve(__dirname, '..', '..', '..', 'target', `browser-login-${process.env.TROVA_RUN_ID?.trim() || 'local'}.txt`);

export function heldLogin(): string {
  try { return fs.readFileSync(HOLDS, 'utf8'); } catch { return ''; }
}

export function holdLogin(login: string): void {
  fs.mkdirSync(path.dirname(HOLDS), { recursive: true });
  fs.writeFileSync(HOLDS, login, 'utf8');
}

/** a new browser holds no login yet */
export function forgetHeld(): void {
  fs.rmSync(HOLDS, { force: true });
}
