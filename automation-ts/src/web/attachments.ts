import * as fs from 'node:fs';
import * as path from 'node:path';
import { projectRoot } from '../run/runDataFile';

/**
 * The files uploaded in Trova (Test Data > Attachments) - an Excel to import, a picture or a PDF to upload, a JSON body -
 * by the name they have there; the TS twin of utils.Attachments. The runner brings data/attachments up to date before
 * every run; TROVA_ATTACHMENTS_DIR points elsewhere.
 */
export function attachmentsDir(env: Record<string, string | undefined> = process.env): string {
  return env.TROVA_ATTACHMENTS_DIR?.trim() || path.join(projectRoot(), 'data', 'attachments');
}

/** every attachment's name, sorted, without the runner's own hidden list */
export function attachmentNames(dir: string = attachmentsDir()): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((f) => f.isFile() && !f.name.startsWith('.'))
    .map((f) => f.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** the full path of an attachment (names ignore case), e.g. for a file field; a missing one fails in plain words */
export function attachmentPath(name: string, dir: string = attachmentsDir()): string {
  const names = attachmentNames(dir);
  const found = names.find((n) => n.toLowerCase() === name.toLowerCase());
  if (!found) {
    throw new Error(`No attachment "${name}" (there are: ${names.join(', ') || 'none'}) - upload it in Trova > Test Data > Attachments; a run from Trova brings it here`);
  }
  return path.join(dir, found);
}

export function attachmentBytes(name: string, dir: string = attachmentsDir()): Buffer {
  return fs.readFileSync(attachmentPath(name, dir));
}

/** the attachment as UTF-8 text (a JSON body, a CSV) */
export function attachmentText(name: string, dir: string = attachmentsDir()): string {
  return attachmentBytes(name, dir).toString('utf8');
}
