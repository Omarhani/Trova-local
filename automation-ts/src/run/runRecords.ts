import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * The records a run made, per kind, so its clean-up deletes exactly those - the TS twin of utils.RunIds. Kept in a
 * file of the run (blocks may run in different worker processes), never values of a login.
 */
export class RunRecords {
  constructor(private readonly file: string) {}

  keep(key: string, id: string): void {
    const all = this.read();
    (all[key] ??= []).push(id);
    this.write(all);
  }

  /** every id kept under the key, newest first; empty when none */
  newestFirst(key: string): string[] {
    return [...(this.read()[key] ?? [])].reverse();
  }

  /** takes one id off the list once a test deleted it itself */
  forget(key: string, id: string): void {
    const all = this.read();
    all[key] = (all[key] ?? []).filter((x) => x !== id);
    this.write(all);
  }

  /** every kind that has at least one id */
  kinds(): string[] {
    return Object.entries(this.read()).filter(([, ids]) => ids.length > 0).map(([kind]) => kind);
  }

  private read(): Record<string, string[]> {
    if (!fs.existsSync(this.file)) return {};
    return JSON.parse(fs.readFileSync(this.file, 'utf8')) as Record<string, string[]>;
  }

  private write(all: Record<string, string[]>): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(all), 'utf8');
  }
}

/** the run's records: one file per run (TROVA_RUN_ID), under automation-ts/target */
export const runRecords = new RunRecords(
  path.resolve(__dirname, '..', '..', 'target', `records-${process.env.TROVA_RUN_ID?.trim() || 'local'}.json`));
