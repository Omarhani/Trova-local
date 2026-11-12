#!/usr/bin/env node
// Checks every TestNG suite under suiteFiles/: each <class name> is a real class in src/test/java (or src/main/java),
// each <methods><include|exclude name> is a real method of that class (or a parent class), each <suite-file path> is
// a real file. Prints the suites and tests it sees (the same count Trova's Tests page imports). Exit 1 on a problem.
// Usage: node tools/suite-check.js [projectFolder]
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const SOURCES = ['src/test/java', 'src/main/java'].map((d) => path.join(root, d));
const problems = [];

function walk(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

function sourceOf(className) {
  for (const base of SOURCES) {
    const file = path.join(base, className.replace(/\./g, '/') + '.java');
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  }
  return null;
}

// the class named by `extends X`, as a full name (its import, else the same package)
function parentOf(className, code) {
  const m = code.match(/\bclass\s+\w+(?:<[^>]*>)?\s+extends\s+([\w.]+)/);
  if (!m) return null;
  const simple = m[1];
  if (simple.includes('.')) return simple;
  const imp = code.match(new RegExp('^import\\s+([\\w.]+\\.' + simple + ');', 'm'));
  if (imp) return imp[1];
  return className.includes('.') ? className.slice(0, className.lastIndexOf('.') + 1) + simple : simple;
}

function hasMethod(className, method, seen = new Set()) {
  if (seen.has(className)) return false;
  seen.add(className);
  const code = sourceOf(className);
  if (!code) return false;
  if (new RegExp('\\b' + method + '\\s*\\(').test(code)) return true;
  const parent = parentOf(className, code);
  return parent ? hasMethod(parent, method, seen) : false;
}

// @Test methods of a class, like Trova's importer reads them
function testMethods(code) {
  const out = [];
  const re = /@Test\b(?:\s*\([^)]*\))?\s*(?:@\w+(?:\([^)]*\))?\s*)*public\s+[\w<>\[\], ]+\s+(\w+)\s*\(/g;
  let m;
  while ((m = re.exec(code))) out.push(m[1]);
  return out;
}

const suites = walk(path.join(root, 'suiteFiles'), '.xml');
let tests = 0;
for (const file of suites) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const xml = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  for (const sf of xml.matchAll(/<suite-file\s+path\s*=\s*"([^"]+)"/g)) {
    const target = [path.resolve(path.dirname(file), sf[1]), path.resolve(root, sf[1])].find((p) => fs.existsSync(p));
    if (!target) problems.push(`${rel}: suite file "${sf[1]}" not found`);
  }
  for (const block of xml.matchAll(/<test\b[^>]*>([\s\S]*?)<\/test>/g)) {
    const kept = new Set();
    for (const cls of block[1].matchAll(/<class\s+name\s*=\s*"([^"]+)"\s*(\/>|>([\s\S]*?)<\/class>)/g)) {
      const name = cls[1];
      const code = sourceOf(name);
      if (!code) {
        problems.push(`${rel}: class ${name} not found in src/test/java or src/main/java`);
        continue;
      }
      const body = cls[3] || '';
      const include = [...body.matchAll(/<include\s+name\s*=\s*"([^"]+)"/g)].map((x) => x[1]);
      const exclude = [...body.matchAll(/<exclude\s+name\s*=\s*"([^"]+)"/g)].map((x) => x[1]);
      for (const m of [...include, ...exclude]) {
        if (!hasMethod(name, m)) problems.push(`${rel}: method ${name}#${m} not found`);
      }
      for (const m of testMethods(code)) {
        if ((include.length && !include.includes(m)) || exclude.includes(m)) continue;
        kept.add(name + '#' + m);
      }
    }
    tests += kept.size;
  }
}

console.log(`Suites: ${suites.length}  Tests in suites: ${tests}  Problems: ${problems.length}`);
problems.forEach((p) => console.log('  - ' + p));
process.exit(problems.length ? 1 : 0);
