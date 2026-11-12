# Agent tools: JavaScript to TypeScript - move plan (Phase 2)

Omar 2026-11-09: "ai execute no js, all ts". Nothing in `platform/agent-tools` is converted in Phase 1 (another session
is changing helpers 92-94). This is the plan for Phase 2.

## Today

- `platform/agent-tools`: 196 tool files + 118 `*.test.js` (node:test), ~21,900 lines, plain CommonJS.
- They ship inside the runner jar (`trova-agent-tools/`, read by `AgentToolsBundle`) and are unpacked on each computer.
- The new TS framework (`automation-ts`) already re-implements some of the same rules (sign-in recipe, known calls,
  live feed). Phase 2 makes ONE copy of each rule.

## Target layout

```
platform/trova-ts/
  tsconfig.base.json             strict, ES2022, CommonJS output
  packages/core/                 pure rules, no browser / phone / file system  -> used by BOTH
  packages/agent-tools/          the AI-run tools (MCP servers, browser + phone drivers, monitor)
automation-ts/                   the project's test framework (Playwright / WebdriverIO) - imports packages/core
```

`packages/core` is published inside the repo only (a `file:` dependency / TS project reference), never to npm.
A company project gets it the same way it gets Trova's helpers today: a pinned copy under `automation-ts/src/trova/`,
refreshed by the runner's HouseFiles step with a fingerprint (same rule as `utils`, be.md 2026-10-31).

## Files grouped by job (and where each goes)

| Job | Files (trova-*.js) | Goes to |
|---|---|---|
| Names and words (shared) | arabic-letters, name-clean, element-names, control-meaning, near-label, step-words, text-has, icon-words, secret-note | core/names |
| Picking from lists (shared) | option-match, pick-any, pick-list, pickers, short-lists, list-names, open-list | core/pick |
| Table rows (shared) | row-anchor, row-cells, row-delete, row-delete-tip, list-count, short-table, table-search | core/rows |
| Proof lines (shared) | proof-lines, step-evidence, step-saw, step-expected, replay-expect, replay-count, record-dates, typed-values | core/proof |
| App calls and sign-in (shared with automation-ts/src/signin + src/api) | signin-api, signin-once, signin-reuse, call-signin, login-values, login-field, known-body, known-call, api-headers, api-record, app-answer, page-call | core/signin, core/api |
| Browser driving | browser, cdp, cdp-limit, browser-storage, click-cover, click-target, fill-field, hover-tip, icon-click, icon-read, page-check, page-look, page-messages, page-quiet, page-setting-tool, row-anchor-web, scope-web, search-button, tab-reset, stay-browser, same-page, landing, screen-diff, screen-element, snapshot-lists, snapshot-trim, whole-screen, short-screen, short-settle, view-web | agent-tools/web |
| Phone driving | phone-* (29 files), view-phone, device-tools | agent-tools/phone |
| Sign-in on screen | login-page-keys, login-page-src, login-resume, login-signed, login-done, login-limit, live-signin, run-login, refused-login, password-box | agent-tools/signin |
| AI-run judging and replay | monitor-*, step-* (rest), replay-* (rest), action-*, check-tools, code-first, code-check, hand-no-effect, handed-screen, guard, path-guard, repeat-guard, stay-on-task, plan-nudge, scope, scope-line, timing, pause, pause-proxy, step-count, step-pace, step-recent, step-settle, step-shot, step-undone | agent-tools/run |
| Clean-up | cleanup-keep, cleanup-way, owed-cleanup, monitor-cleanup, monitor-cleanup-flow, monitor-cleanup-step | agent-tools/cleanup |
| Writer (automation) | automation-find, collect-elements, element-replay, locator-check, map-shot, map-visit, playwright-line, writer-lesson, files-changed | agent-tools/writer |
| Tool surfaces (MCP) | mcp, mcp-server, aihelp-mcp, airun-tools, airun-browser, *-tools (case-model, case-read, connector, device, knowledge, login, page-api, plan, project, replay, suite, suite-run), chat-run-tool, trova-call, trova-do, test-data-do, tool-params, how-i-work, warm-start, view-gate, view-policy | agent-tools/mcp |

## Order (each step its own PR, behaviour unchanged, tests green before and after)

1. **Done (runner 102):** set-up: `platform/trova-ts` with `tsconfig.base.json`, `tsc -b`, the runner build copies `packages/agent-tools/dist`
   into `trova-agent-tools/` (Maven `exec` step before `process-resources`); nothing converted yet - the jar's file
   list must be the same before and after (a check compares the two lists).
2. **Done (runner 103), the pure part:** `core/names`, `core/pick`, `core/rows`, `core/proof` - pure, with their tests. The JS tools import the compiled
   core, so AI runs keep working while the rest is still JS.
3. **Done (runner 104), the pure part:** `core/signin` + `core/api`: one sign-in recipe runner and one known-call filler; `automation-ts` drops its own
   copies (`src/signin/recipeValues.ts`, `recipeSignIn.ts`, `src/api/knownCall.ts`, `phoneShape.ts`) and imports core.
4. **Done (runner 105), as a text move:** phone driving, then browser driving (largest), then sign-in on screen.
5. **Done (runner 106), as a text move:** judging / replay / clean-up / writer (67 tools, 42 tests; the 4 hook scripts
   keep their #! line first and answer the same as before).
6. **Done (runner 107), as a text move:** tool surfaces (MCP servers) last - they only wire the rest (25 tools incl.
   test-data-do; both MCP servers give the same tool list as before).
7. **Done:** remove `platform/agent-tools/*.js` (the last 27 JS tests moved; git keeps only package.json, its lock and the
   .gitignore of the built copies; the Docker image takes every tool from the TS build); `fia.runner.version` moves at every step that changes what ships.

## Group 1 as built (runner 102)

- `platform/trova-ts`: `tsconfig.base.json` (strict, ES2022, CommonJS, composite), `packages/core`, `packages/agent-tools`
  (references core); build info inside each `dist`, so a removed `dist` always rebuilds.
- `build.js` (node only): `npm ci` with the npm next to this node when the compiler is missing or the lock file is newer,
  then `tsc -b packages/core packages/agent-tools`; its children get a short PATH (node folder + System32), never cmd/npx.
- `platform-runner/pom.xml`: antrun step `trova-ts` (generate-resources) - no node on the PATH = a plain stop; the jar gets
  `packages/agent-tools/dist/trova-*.js` next to the JS tools. `-Dtrova.ts.skip=true` skips the step (the Docker image
  builds trova-ts in its own node stage first).
- `checks/agent-tools-bundle-check.js` + `trova-ts/bundle-files.txt` (205 files): the jar's tool list stays the same.
- Still to do when the first tool moves (group 2): the Docker runner image copies the built tools to `/opt/agent-tools`
  next to the JS ones (a COPY that matches no file fails, so it waits for the first file).

## Group 2 as built (runner 103)

- Moved (pure: no page, phone, file or other JS tool): arabic-letters, name-clean, element-names, step-words, text-has,
  icon-words, list-count, record-dates, typed-values, row-cells, short-table -> `packages/core/src/trova-<name>.ts`
  (flat names, so `require('./trova-x')` in the JS tools keeps working). Types added, bodies unchanged.
- `build.js` puts the built files, marked "Built from ... - edit that file", next to the JS tools: the jar's folder
  (`packages/agent-tools/dist`) and the checkout's `platform/agent-tools` (git ignores them there, `.gitignore`).
- Proof of "behaviour unchanged": all JS tool tests ran against the built files first - the same 911 of 915 pass as on
  dev before (4 fail on dev already: 2 phone screen dumps, 2 replayed count rises). Then 4 tests moved to TS
  (arabic-letters, icon-words, row-cells, record-dates: 19 tests, `npm test` in trova-ts); list-count and step-words
  tests stay JS while they also test tools not moved yet.
- Held back for group 4 (they use the page, the phone or files, or other JS tools): control-meaning, near-label,
  secret-note, option-match, pick-any, pick-list, pickers, short-lists, list-names, open-list, row-anchor, row-delete,
  row-delete-tip, table-search, proof-lines, step-evidence, step-saw, step-expected, replay-expect, replay-count.

## Group 3 as built (runner 104)

- automation-ts's sign-in recipe (`recipeValues`, `recipeSignIn`), known-call filler (`knownCall` rules), phone call
  shape (`phoneShape`), the call's shape (`http` types) and JSON readers (`json`) moved to `packages/core/src` as they
  were; automation-ts keeps a byte-same copy in `src/trova` (a company project has no platform/ folder) and imports it;
  `sync-core.js` refreshes it, `checks/trova-core-copy-check.js` says when it is behind. Its own loaders (the run file's
  known calls, the real fetch) stay in automation-ts. Its 149 unit tests pass against the copy.
- AI tools moved to core under their old names: app-answer, api-headers, login-field, signin-once (+ its 6 tests in TS).
  JS tool tests against the built files: 886 of 890 pass, the same 4 dev failures as before.
- Not one filler yet: the AI's `known-body` (fits the agent's values into a known body, reads the session file) and the
  written tests' `knownCall` (fills placeholders and sign-in ids, the Java KnownCall rule) are two different rules today -
  making them one changes behaviour, so it is its own task. Held back (browser, files or JS tools): signin-api,
  signin-reuse, call-signin, login-values, known-body, known-call, api-record, page-call.

## Group 4 as built (runner 105)

- 96 tools (phone, browser, on-screen sign-in, and everything held back in groups 2-3) and their 44 tests moved to
  `packages/agent-tools/src/trova-<name>.ts` by `tools/move-tools.py`: the SAME text (CommonJS kept: `require` /
  `module.exports`, plus `export {}`), so behaviour cannot change. Each file starts with `// @ts-nocheck`: tsc builds it
  but does not check its types yet - 507 type findings in strict mode today. Typing them is one file per step later (the
  line goes when its file is typed); the package itself stays strict for new and typed files.
- `build.js` places every built tool and test into the checkout's `platform/agent-tools` (git ignores them,
  `.gitignore` is the list) - `npm test` in trova-ts runs all tool tests there: 911 of 915 pass, the same 4 dev failures.
- Every moved tool loads like its JS before (page-check stops the same way without its input).
- Later, its own task: ONE known-call fill rule. Today the AI's `known-body` (fits the agent's values into a known body)
  and the written tests' `knownCall` (fills placeholders and the sign-in's ids, Java KnownCall) differ; making them one
  changes behaviour, so it is not part of the move.

## Typing steps (after the move)

- One step per file (or a few small ones): its `@ts-nocheck` line goes, types are added, `require` of a typed file
  becomes `import`, the body does not change. All tool tests stay 911 of 915 (the 4 dev failures) after each step.
- Order: the riskiest first - the files every AI run goes through (MCP servers' wiring, monitor, browser, phone), then
  the rest. `grep -l "@ts-nocheck" platform/trova-ts/packages/*/src` is the list still to do.

## Shared web/phone logic as ONE module

- Name folding (`arabic-letters` + `name-clean`), picking (`option-match` + `pick-*`), row cells (`row-cells` +
  `row-anchor`) and proof lines (`proof-lines` + `step-evidence`) become `@trova/core` functions that take plain data
  (texts, rows as string arrays, what was seen) - never a page or a phone. The web side reads rows from the page tree,
  the phone side from its screen XML, both call the same function.
- `automation-ts` page objects call the same core: e.g. `RegistrationRequestsPage.rowTextOfUser` can use
  `core/rows.oneRowWithAll(cells, texts)` so a written test and an AI run judge a row the same way.

## Tests

- Each `*.test.js` becomes `*.test.ts` next to its file, same cases, same names; run with `node --test` on the compiled
  output (`tsc -b && node --test "dist/**/*.test.js"`) - no new test library.
- A converted file must pass its old JS tests first (the old test file run against the new compiled output), then the
  test itself is converted. Count before / after is written on the PR.

## Build step

- `npm run build` in `platform/trova-ts` = `tsc -b packages/core packages/agent-tools` (strict, no emit on error).
- The runner jar is built only from `dist/`; the runner never runs `.ts` itself and never needs `tsc` on a client's
  computer.
- `checks/new-files-check.js` and `checks/code-size-check.js` learn `.ts` (400 lines per file, 50 per function).
