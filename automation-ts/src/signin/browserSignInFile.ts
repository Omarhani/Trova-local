import * as fs from 'node:fs';
import * as path from 'node:path';
import { testData } from '../run/testData';
import { Json } from '../trova/json';
import { BrowserLook, lookAt } from './browserSignIn';

/** <automation-ts>/target/saved-sign-ins (git-ignored), or TROVA_SAVED_SIGN_INS_DIR - the save tool uses the same */
export function savedSignInsDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.TROVA_SAVED_SIGN_INS_DIR?.trim() || path.resolve(__dirname, '..', '..', 'target', 'saved-sign-ins');
}

/** "<env>-<login>.json", any letter case (the save tool names it the same way) */
export function savedSignInName(env: string, login: string): string {
  const part = (text: string): string => text.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_') || '_';
  return `${part(env)}-${part(login)}.json`;
}

/** the file's JSON; undefined = no file, null = there but not JSON (its text is never shown) */
function readFile(file: string): Json | undefined {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
  try {
    return JSON.parse(text.replace(/^﻿/, '')) as Json;
  } catch {
    return null;
  }
}

/**
 * The sign-ins the tester made in a real browser and saved on this computer (Omar 2026-11-10: the Availo Test sign-in
 * asks Google's robot check, so the app's own sign-in calls are refused) - one file per environment and login, read
 * fresh each time it is asked for. Its values are never printed.
 */
export class BrowserSignIns {
  constructor(private readonly env: () => string = () => testData.env(), private readonly dir: () => string = () => savedSignInsDir(),
              private readonly now: () => number = () => Date.now()) {}

  look(login: string): BrowserLook {
    return lookAt(readFile(path.join(this.dir(), savedSignInName(this.env(), login))), login, this.now());
  }
}

/** the run's one reader */
export const browserSignIns = new BrowserSignIns();
