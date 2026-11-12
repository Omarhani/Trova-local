#!/usr/bin/env node
'use strict';
/**
 * Saves a sign-in the tester made himself in a real browser, for the runs of one environment and login (Omar
 * 2026-11-10: the app's sign-in asks Google's robot check, so Trova never signs in by itself there - no bypass).
 *
 *   node tools/save-browser-sign-in.js <environment> <login>      the browser state as JSON on stdin
 *
 * The state - on the app's page, signed in, in the browser's DevTools console:
 *   copy(JSON.stringify({ origin: location.origin, localStorage: { ...localStorage }, sessionStorage: { ...sessionStorage },
 *     cookies: Object.fromEntries(document.cookie.split('; ').filter(Boolean).map((c) => [c.split('=')[0], c.slice(c.indexOf('=') + 1)])) }))
 * then pipe it in (or paste it and end with Ctrl+Z Enter / Ctrl+D). Optional "expiresAt" (a date) sets its end.
 *
 * Writes <automation-ts>/target/saved-sign-ins/<env>-<login>.json (git-ignored; TROVA_SAVED_SIGN_INS_DIR elsewhere),
 * owner-only, and prints only its keys and when it ends - never a value.
 */
const fs = require('node:fs');
const path = require('node:path');

const PLACES = ['localStorage', 'sessionStorage', 'cookies'];
const JWT = /eyJ[A-Za-z0-9_-]{4,}\.(eyJ[A-Za-z0-9_-]{4,})\.[A-Za-z0-9_-]*/g;
const USAGE = 'Usage: node tools/save-browser-sign-in.js <environment> <login>   (the browser state as JSON on stdin)';
const AGAIN = 'copy it again from the browser';

function fail(line) {
  process.stderr.write(`${line}\n`);
  process.exit(1);
}

/** the same name rule as src/signin/browserSignInFile.ts savedSignInName */
function part(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_') || '_';
}

function folder() {
  return (process.env.TROVA_SAVED_SIGN_INS_DIR || '').trim() || path.resolve(__dirname, '..', 'target', 'saved-sign-ins');
}

/** the given text as a browser state; its text is never shown, not even in an error */
function readState(text) {
  let state;
  try {
    state = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    fail(`The text given is not a browser state (JSON) - ${AGAIN}`);
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) fail(`The text given is not a browser state - ${AGAIN}`);
  if (!PLACES.some((p) => state[p])) fail(`The browser state has no localStorage, sessionStorage or cookies - ${AGAIN}`);
  return state;
}

/** names to values; a cookie list ([{name, value}]) as names to values */
function values(place) {
  if (Array.isArray(place)) return Object.fromEntries(place.filter((c) => c && c.name).map((c) => [String(c.name), String(c.value ?? '')]));
  const all = place && typeof place === 'object' ? place : {};
  return Object.fromEntries(Object.entries(all).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
}

/** expiresAt, else the first "exp" of any token in the values (epoch ms, 0 = not known) */
function endOf(file) {
  if (file.expiresAt !== undefined) {
    const n = typeof file.expiresAt === 'number' ? (file.expiresAt > 1e11 ? file.expiresAt : file.expiresAt * 1000) : Date.parse(file.expiresAt);
    if (!Number.isNaN(n)) return n;
  }
  let end = 0;
  for (const p of PLACES) {
    for (const v of Object.values(file[p])) {
      for (const m of v.matchAll(JWT)) {
        const exp = expOf(m[1]);
        if (exp && (!end || exp < end)) end = exp;
      }
    }
  }
  return end;
}

function expOf(payload) {
  try {
    const exp = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).exp;
    return typeof exp === 'number' ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

function clock(ms) {
  const d = new Date(ms);
  const two = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** owner-only file, written whole (.part, then moved) */
function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(`${file}.part`, JSON.stringify(content, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(`${file}.part`, file);
  fs.chmodSync(file, 0o600);
}

function main() {
  const [env, login] = process.argv.slice(2);
  if (!env || !login) fail(USAGE);
  const state = readState(fs.readFileSync(0, 'utf8'));
  const file = { savedAt: new Date().toISOString(), origin: String(state.origin || '') };
  if (state.expiresAt !== undefined) file.expiresAt = state.expiresAt;
  for (const p of PLACES) file[p] = values(state[p]);
  const end = endOf(file);
  if (end && Date.now() >= end) fail(`This sign-in already ended (${clock(end)}) - sign in again in the browser first`);
  write(path.join(folder(), `${part(env)}-${part(login)}.json`), file);
  const keys = (p) => Object.keys(file[p]).join(', ') || '(none)';
  console.log(`Saved the browser sign-in of ${login} for ${env}`);
  for (const p of PLACES) console.log(`  ${p}: ${keys(p)}`);
  console.log(end ? `  ends ${clock(end)}` : '  ends: not known (no end in it) - the run checks the app took it');
}

main();
