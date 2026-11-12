# TS pilot - results (Phase 1, 2026-11-09/10)

Branch `task/ts-pilot` (worktree `D:\wt-ts`), not pushed, not merged. Trova's screens, Runs tab, Tests page, reports
and suites stay the same; the server stays Spring.

## What was built

| Part | Where | State |
|---|---|---|
| TS framework (strict, Playwright Test 1.56, WebdriverIO 9, TS 5.9) | `automation-ts/` | built, type-checks, 54 unit tests green |
| Logins by name, environment data, run records, `{run}` stamps - read from the SAME run file as Java (`FIA_CREDENTIALS_FILE` / `data/credentials.json`) | `src/run/` | built + unit tested |
| API sign-in once per run from Trova's recipe, shared sign-in first, refusals never retried | `src/signin/` | built + unit tested |
| Web and phone API clients, Trova's known bodies, phone call envelope | `src/api/` | built + unit tested |
| Web case 340 (Playwright), page object ported 1:1 from Java | `tests/web/emloyess2/`, `src/web/pages/` | built, NOT run on the app (see Blocks) |
| Phone sign-in + check-in, clean-up = check out (WebdriverIO + Appium, same capabilities as `base.PhoneOptions`) | `tests/mobile/attendance/`, `src/phone/` | built, NOT run on the phone |
| Overtime set-up by phone API as "Employee over Time" (today), clean-up deletes it | `tests/api/overtimeManagement/` | built, NOT run on the app |
| Live feed: the same `@@live` run / test / end / step / check lines Java prints | `src/report/` | built + unit tested; seen in dry runs |
| Runner runs a TS suite (`TsSuiteCommand`, `TsRun`), reads its JSON report into the same run events (`TsResults`) | `platform-runner` | built, 13 new tests (red first), Java way unchanged (50 related tests green), runner 95 |
| Trova reads TS page objects (App map match / update) | `platform-api` `PomSources`, `PomTsFields` | built, 5 new tests (red first), 73 App map tests green |
| Terms + Privacy line (TS test tools installed on first TS run), terms 2026-11-09.2 | `legalContent.ts`, `TermsConsent` | done |

Red-first tests: `tests/unit/*.spec.ts` (commit 7882340), `TsSuiteCommandTest` + `TsResultsTest` (b718a96),
`TsPageObjectsTest` (9f0d485).

## Numbers

| Measure | Java | TS | Note |
|---|---|---|---|
| Case 340 - time per run (Test 8094, started from Trova) | block 15 s (suite 36 run 584: 8 blocks, 76 s) | test 13-14 s; whole TS suite (sign-in + 340 + clean-up) 20-22 s | TS runs 577, 580-583; Java run 584 |
| Case 340 - flaky in 5 runs | 1 run so far (passed) | 0 of 5 (5 of 5 passed: runs 577, 580-583) | the first TS try (574) failed before the sign-in fix (page settings) |
| Case 340 - test method lines | 29 | 31 | same steps, same checks |
| Case 340 - page object lines | 215 (all of 340-342 + traps) | 97 (what 340 uses) | |
| Phone check-in - time | AI run 571: 102 s | runs 587 / 588 passed: 147 s / 184 s; after the speed change (one screen read per look, finger taps): next run to measure | measured on the phone: screen look 0.13 s, server box tick 0.65 s, account code typed 3.7 s, app start with its data cleared 17-19 s (the app's own cold start) |
| API set-up (overtime) - time | not measured | blocked by logins (runs 575, 578) | "Employee over Time" already has today's request (one per employee per day); "Employee over Time 2" phone sign-in refused (HTTP 400 at the account code) |
| Framework start-up to first test (3-block suite, no app) | not measured | 4.6 s (3 runs: 4.78 / 4.61 / 4.64 s) | Maven start + compile not included for Java |
| Hidden Chrome start + close (Playwright, installed Chrome) | - | 0.84 s | |
| Framework unit tests | - | 89 in about 4 s | |

A pass must mean the expected result was seen: every check prints its own line (`check` event) with the value read;
nothing is passed without it. A run without Trova's run file stops with "Run this suite from Trova" (seen in the dry
runs: 340 failed with that reason, the clean-up skipped "Nothing was kept by this run").

## Blocks (what is missing - not guessed)

1. **The run's logins and test data file.** Only Trova's runner writes it (`/api/runner/credentials`, with a runner
   key), right before a run, and deletes it after. Without it no web, phone or API run can sign in. To run the 5x
   measurements I need ONE of: (a) Omar's go to restart Test 8094 with this branch's runner and start the TS suites
   from Trova (that is also the "started through Trova's runner" check), or (b) a runner key for Availo on Test 8094
   given to this worktree's runner.
2. **The phone.** One phone is attached (EE4PORJ7S86TYHFU) and Appium answers on 4723, but I did not start a session:
   another session runs AI work on this PC, and the phone check-in makes a real attendance record.
3. **The TS run gate.** Java runs check the run's one-time pass through Trova's closed core jar (`TrovaRun`); the TS
   side only refuses without the run file. Phase 2: the runner checks the pass before it starts a TS run, or a small
   Node check of the same pass.
4. **The TS folder in a company project.** The runner runs `automation-ts` from the run's checkout. A company project
   gets it only when its code has it - Phase 2: the starter project and HouseFiles refresh carry `automation-ts`.

## Suite files and the writer - TestNG to TS mapping

Trova keeps ONE suite file per suite (the TestNG XML it already has). A TS suite is the same file; only the class
names point at TS specs. Nothing changes on Trova's screens.

| TestNG / Java | TS (this pilot) |
|---|---|
| `<suite name>` | the run's name in the live feed (`run` event) |
| `<test name="Case 340 - ...">` block | one Playwright project, same name, run in file order, one at a time (`workers: 1`) |
| `<class name="tests.web.emloyess2.Emloyess2Tests">` | `<class name="ts:tests/web/emloyess2/emloyess2.spec.ts">` |
| `<include name="testVerify...">` method | the test of the same name in the spec (`grep` on the title) |
| `<parameter>` (suite and block, block wins) + `@Optional` | `param(name, default)` from the block's metadata |
| `{run}` / `{run:340}` stamps | filled by the runner in the run's suite file (same as Java); `fresh()` for defaults |
| `<groups>` Web / Mob | project metadata groups; the live `type` (web / mobile / api) |
| `signedInAs` / Runs as / roles | `runLogin(param('signedInAs'))`, `credentials.get(login, field)` |
| Listeners (ReportListener, LiveFeed) | `src/report/liveReporter.ts` + `checks.ts` (same `@@live` lines) |
| testng-results.xml fallback | Playwright JSON report -> `TsResults` (same events) |
| Retries | `TROVA_RETRIES` -> Playwright retries; the last try decides (as in `TsResults`) |
| Single-test run | Trova sends a suite file with one block - same path |
| Data sets (one block per data row) | one block per row, as today - each is its own project |
| Set-up / clean-up blocks (`logInProgrammatically`, `cleanUpProgrammatically`) | the same names in `tests/api/...spec.ts`; records via `runRecords` |
| `utils.CaseRecords` / `RunIds` | `src/run/runRecords.ts` (a file per run, blocks may run in other workers) |
| Java page class `pages/XPage.java`, `By x = By.xpath("...")` | `src/web/pages/XPage.ts`, `private readonly x = By.xpath("...")` - App map reads, matches and edits both |
| Phone screen `screens/XScreen.java` | `src/phone/screens/XScreen.ts`, `AppiumBy.xpath("...")` |

Writer output shape (Phase 2 makes the writer produce it; the pilot files ARE the shape):

- one page object per page (`src/web/pages/<Page>Page.ts`) / screen (`src/phone/screens/<Name>Screen.ts`), one
  method per page action named from the step, locators as `By.xpath("...")` fields;
- one spec per suite area (`tests/<web|mobile|api>/<area>/<area>.spec.ts`), tests named `test` + the case title in
  camelCase (house rule), checks through `checkEquals / checkContains / checkTrue` with plain names;
- the suite file: the same XML Trova keeps, blocks "Case <id> - <title>", classes `ts:<spec>`.
- Case 340: `suites/emloyess2-ts.xml` + `tests/web/emloyess2/emloyess2.spec.ts` + `src/web/pages/RegistrationRequestsPage.ts`.
- Phone case: `suites/attendance-ts.xml` + `tests/mobile/attendance/attendance.spec.ts` + `src/phone/screens/*.ts`.
- Overtime set-up: `suites/overtime-ts.xml` + `tests/api/overtimeManagement/overtimeManagement.spec.ts`.

Why one runner (Playwright Test) for phone too: WebdriverIO is used as the phone driver inside Playwright Test, so web,
phone and API share one suite file reader, one live reporter and one report the runner reads. A separate wdio test
runner would need its own reporter and report reader for the same result.

## How to run (once the run file is there)

```
cd automation-ts
npm ci
npx playwright test                                   # unit tests of the framework
TROVA_SUITE_FILE=suites/emloyess2-ts.xml npx playwright test   # a suite, as the runner starts it
```
