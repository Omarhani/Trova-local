import * as fs from 'node:fs';
import * as path from 'node:path';
import { asObject, asText, Json, JsonObject } from '../trova/json';

export { asObject, asText };
export type { Json, JsonObject };

/**
 * The run's data file Trova's runner writes just before a run and deletes right after it (git-ignored): the
 * environment's logins, its test data, sign-in recipes, shared sign-ins and known calls - the same file the Java
 * helpers read (FIA_CREDENTIALS_FILE, else data/credentials.json in the project). Never print a value read here.
 */

export const REFUSAL = 'Run this suite from Trova - it gives each run its logins and test data';

let cached: JsonObject | undefined;

/** the project folder: the parent of automation-ts */
export function projectRoot(): string {
  return path.resolve(__dirname, '..', '..', '..');
}

/** where the run's file is: FIA_CREDENTIALS_FILE, else <project>/data/credentials.json */
export function runDataPath(env: NodeJS.ProcessEnv = process.env): string {
  const given = env.FIA_CREDENTIALS_FILE?.trim();
  return given ? given : path.join(projectRoot(), 'data', 'credentials.json');
}

/** the whole file, read once per process; a missing file stops the run in plain words */
export function runData(): JsonObject {
  if (cached) return cached;
  const file = runDataPath();
  if (!fs.existsSync(file)) throw new Error(REFUSAL);
  cached = parseObject(fs.readFileSync(file, 'utf8'));
  return cached;
}

/** one part of the file ("logins", "testData", "signInApi" ...); {} when it is not there */
export function section(name: string): JsonObject {
  return asObject(runData()[name]);
}

export function parseObject(text: string): JsonObject {
  return asObject(JSON.parse(text.replace(/^﻿/, '')) as Json);
}


/** the entry whose key equals name, case and outer spaces ignored */
export function byName(all: JsonObject, name: string): Json | undefined {
  const want = name.trim().toLowerCase();
  const key = Object.keys(all).find((k) => k.trim().toLowerCase() === want);
  return key === undefined ? undefined : all[key];
}
