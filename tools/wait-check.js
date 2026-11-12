#!/usr/bin/env node
// TICKET-983 (Omar 2026-10-23, "handle everything with wait"): page, screen and test code reads and acts only through the
// project's wait helpers (MethodHandlesWeb / MethodHandlesMobile / BaseScreen / WaitedReads). Flags, outside those helpers:
// bare findElement(s) / webElements() reads, element .click() / .sendKeys() / .clear() / .getText() / .getAttribute() /
// .isDisplayed() / .isEnabled() / .isSelected(), Thread.sleep, and a toast / alert / message text compared with equals
// (use textBecomes / messageOf / UiText.visibleMessage - never text with the close button "×").
// Scans src/main/java/pages, src/main/java/screens and src/test/java (but not its utils/ and base/ framework code).
// A line that must stay ends with "// wait-ok: <why>". Exit 1 when anything is flagged.
// Usage: node tools/wait-check.js [projectFolder]
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const DIRS = ['src/main/java/pages', 'src/main/java/screens', 'src/test/java'].map((d) => path.join(root, d));
const SKIP = [path.join(root, 'src/test/java/utils'), path.join(root, 'src/test/java/base')];

const RULES = [
  [/\bfindElements?\s*\(/, 'findElement(s) reads once - use a wait helper (isShownWithin, countBecomes, settledCount ...)'],
  [/\bwebElements\s*\(/, 'webElements() reads the list once - use countBecomes / settledCount / isShownWithin / isGoneWithin'],
  [/\.(click|clear)\s*\(\s*\)/, 'element click/clear without a wait - use click(locator, seconds) / clear(locator, seconds)'],
  [/\.sendKeys\s*\(/, 'element sendKeys without a wait - use sendKeys(locator, seconds, text) (+ valueBecomes)'],
  [/\.(getText|isDisplayed|isEnabled|isSelected)\s*\(\s*\)/, 'element read once - use getText(locator, s) / textBecomes / isShownWithin / isEnabledWithin / isDisabledWithin'],
  [/\.getAttribute\s*\(/, 'attribute read once - wait for the state first (valueBecomes / isShownWithin)'],
  [/\bThread\.sleep\s*\(/, 'Thread.sleep - wait for the real state instead'],
];
const MESSAGE = /(toast|snack|alert|message|notif)/i;
const EQUALS = /(myAssertEquals|assertEquals|\.equals\s*\()/;
const RAW_TEXT = /(getText\s*\(|getToasterContent\s*\(|toastText\s*\()/;

function walk(dir, out = []) {
  if (!fs.existsSync(dir) || SKIP.some((s) => dir.startsWith(s))) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.java')) out.push(p);
  }
  return out;
}

const hits = [];
for (const file of [...new Set(DIRS.flatMap((d) => walk(d)))]) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let inBlockComment = false;
  lines.forEach((raw, i) => {
    let line = raw.trim();
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false;
      return;
    }
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlockComment = true;
      return;
    }
    if (line.startsWith('//') || line.startsWith('*') || /\/\/\s*wait-ok\b/.test(line)) return;
    line = line.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/\/\/.*$/, '');
    const where = path.relative(root, file).replace(/\\/g, '/') + ':' + (i + 1);
    for (const [re, why] of RULES) {
      if (re.test(line)) hits.push(`${where}  ${why}`);
    }
    if (EQUALS.test(line) && RAW_TEXT.test(line) && MESSAGE.test(raw)) {
      hits.push(`${where}  message text compared with equals - use textBecomes / messageOf (UiText.visibleMessage, no close "×")`);
    }
  });
}

hits.forEach((h) => console.log(h));
console.log(`wait-check: ${hits.length} bare read(s) / action(s) outside the wait helpers`);
process.exit(hits.length ? 1 : 0);
