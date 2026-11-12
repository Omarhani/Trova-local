#!/usr/bin/env node
'use strict';
/**
 * Make automation for Trova's runner: the recorded AI run of each case the tester picked in, the drafts out.
 *
 *   node tools/make-automation.js <records.json> [<drafts.json>] [--root <automation-ts folder>]
 *
 * records.json holds one recorded case or a list of them (src/make/madeRun.ts). The cases are made one after the other
 * over the project's page, screen and API classes as the case before left them - a later case reuses what an earlier
 * one added, never writes it twice. Writes { drafts: [...] } (src/make/draft.ts) to drafts.json, else prints it. Nothing
 * is written into the project here: the runner lays the drafts over a work copy, checks and runs them.
 */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const rootAt = process.argv.indexOf('--root');
/** the project's automation-ts whose classes are read (this tool's own folder unless --root names another) */
const ROOT = rootAt > 0 ? path.resolve(process.argv[rootAt + 1]) : path.resolve(__dirname, '..');
const POM_FOLDERS = ['src/web/pages', 'src/phone/screens', 'src/api/services', 'src/api/flows'];

// the project's TypeScript read as it is, for this one tool (the runs use Playwright's own loader)
require.extensions['.ts'] = (module, file) => {
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  module._compile(out.outputText, file);
};
const { makeAutomation } = require('../src/make/makeAutomation');

/** the page, screen and API classes as they are now (paths from automation-ts, with /) */
function projectCode() {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(path.join(ROOT, dir))) return;
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (rel.endsWith('.ts')) out.push({ path: rel, text: fs.readFileSync(path.join(ROOT, rel), 'utf8') });
    }
  };
  POM_FOLDERS.forEach(walk);
  return out;
}

/** each case made over the code the case before left */
function makeAll(records) {
  let code = projectCode();
  return records.map((record) => {
    const draft = makeAutomation(record, code);
    const changed = new Map(draft.files.map((f) => [f.path, f.text]));
    code = [...code.filter((f) => !changed.has(f.path)), ...draft.files.map((f) => ({ path: f.path, text: f.text }))];
    return draft;
  });
}

function main() {
  const [input, output] = process.argv.slice(2).filter((a, i, all) => a !== '--root' && all[i - 1] !== '--root');
  if (!input) {
    process.stderr.write('Usage: node tools/make-automation.js <records.json> [<drafts.json>]\n');
    process.exit(2);
  }
  const read = JSON.parse(fs.readFileSync(input, 'utf8'));
  const text = JSON.stringify({ drafts: makeAll(Array.isArray(read) ? read : [read]) });
  if (output) fs.writeFileSync(output, text, 'utf8');
  else process.stdout.write(`${text}\n`);
}

main();
