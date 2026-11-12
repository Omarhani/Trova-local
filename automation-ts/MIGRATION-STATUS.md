# Java to TS - suite migration status (Phase 2b)

Source: the Test project (`C:\Users\ahmed\IdeaProjects\Trova\test`, branch `env-test-8094`), `suiteFiles/**/*.xml` and
`src/test/java/tests/**` - read only; the Java suites stay as they are. A TS suite is the same TestNG XML with
`<class name="ts:<spec>">`; block names, order and parameters are kept 1:1 (`tests/unit/suiteFiles.spec.ts` checks every
`suites/*-ts.xml` names specs and tests that exist, and the moved suites keep the Java blocks).

Status: **moved** = TS suite + specs + page objects written, type-checks, unit tests green, NOT yet run on Test 8094;
**run** = passed on Test 8094 from Trova; **to do**; **empty** = the Java file has no blocks (nothing to move).

| Suite | Java file | Blocks (set-up / cases / clean-up) | Kind | TS suite | Status |
|---|---|---|---|---|---|
| Employee and Leaves | `suiteFiles/web/employeeAndLeaves.xml` | Log in programmatically; Case 181, 183, 182, 340; Clean up - Delete the employee record (screen); Case 185; Clean up programmatically | web + api | `suites/employeeAndLeaves-ts.xml` | moved |
| Employee and Leaves (admin copy) | `suiteFiles/admin/employeeAndLeaves.xml` | none | - | - | empty |
| Emloyess 2 | `suiteFiles/web/emloyess2.xml` | Log in programmatically; Case 340, 341, 342 (TS adds the pilot's Clean-up programmatically last, a safety net - 342 already deletes) | web + api | `suites/emloyess2-ts.xml` | moved (340 run 5/5 in the pilot) |
| Emloyess 2 (testOmar copy) | `suiteFiles/testOmar/emloyess2.xml` | none | - | - | empty |
| Invoices | `suiteFiles/hybrid/invoices.xml` | Log in programmatically (web); Admin creates an invoice; Clean up programmatically (cancel by API) | web + api | `suites/invoices-ts.xml` | moved |
| Overtime Management | `suiteFiles/web/overtimeManagement.xml` | Log in programmatically; 4 API set-ups (pending request, rejected request, one for rejecting, one for approving); Case 231, 234, 237, 236, 238, 232, 233, 235; Clean up programmatically | web + api | `suites/overtimeManagement-ts.xml` | moved |
| Overtime Management (folder copy) | `suiteFiles/134021OvertimeManagement/overtimeManagement.xml` | none | - | - | empty |
| Overtime Management traps | `suiteFiles/web/overtimeManagementTraps.xml` | Log in programmatically; 4 API set-ups; Case 242, 245, 239, 241, 244, 246, 240, 243; Clean up programmatically | web + api | `suites/overtimeManagementTraps-ts.xml` | moved (traps: the cases must fail) |
| Overtime Management traps (folder copy) | `suiteFiles/134021OvertimeManagement/overtimeManagementTraps.xml` | none | - | - | empty |
| Plans | `suiteFiles/web/plans-2.xml` | Log in programmatically; Case 290, 291, 292, 297, 298, 299, 294, 293, 295, 296; 7 clean-up blocks (by API, after each changing case) | web + api | `suites/plans-ts.xml` | moved |
| Plans | `suiteFiles/web/plans.xml` | none | - | - | empty |
| Employee | `suiteFiles/web/employee.xml` | none | - | - | empty |
| Failed test cases | `suiteFiles/admin/failedTestCases.xml` | none | - | - | empty |
| Test cases | `suiteFiles/testCases.xml` | none | - | - | empty |
| Attendance (phone pilot) | - (AI case) | sign-in + check-in, clean-up = check out | phone | `suites/attendance-ts.xml` | run (Test 8094 runs 587 / 588) |
| Overtime set-up (API pilot) | - | overtime set-up by phone API, clean-up deletes it | api | `suites/overtime-ts.xml` | moved (blocked by logins in runs 575 / 578) |

Java tests in no suite file (nothing to move until a suite names them): `tests.api.health.HealthApiTests`,
`tests.web.home.HomeTests`, `tests.mobile.home.HomeTests`.

## What the TS side added for these suites

| Java | TS |
|---|---|
| `pages.RegistrationRequestsPage` (whole) | `src/web/pages/RegistrationRequestsPage.ts` |
| `pages.InvoicesPage` | `src/web/pages/InvoicesPage.ts` |
| `api.services.InvoiceApi` | `src/api/services/invoiceApi.ts` (`AppApi.get` added) |
| `utils.CaseRecords` (made / madeForAll / mine) | `src/run/caseRecords.ts` |
| `WaitedReads.textBecomes / isDisabledWithin`, `pressKey`, `UiText.withoutClose` | `src/web/webActions.ts`, `src/web/uiText.ts` |
| `myAssertFalse` | `checkFalse` in `src/report/checks.ts` |
| `pages.OvertimeRequestsPage`, `pages.OvertimeSettingsPage` | `src/web/pages/OvertimeRequestsPage.ts`, `OvertimeSettingsPage.ts` |
| `utils.Switches` (read the switch, click only when it differs) | `src/web/switchState.ts` + `WebActions.setSwitch` |
| `WaitedReads.settledCount / isEnabledWithin / rowsShownWithin` | `src/web/webActions.ts` |
| `pages.WorkPlansPage` (plan list, calendar, shift form, clock face) | `src/web/pages/WorkPlansPage.ts` |
| `api.services.WorkPlanApi`, `utils.LabelledValues.byLabel` | `src/api/services/workPlanApi.ts`, `src/data/workPlanValues.ts`, `src/web/labelledValues.ts` |
| `makePending` / `send` of the Overtime set-ups - NOT 1:1: the app takes a request for TODAY only, one per employee per day, so "Employee over Time", else "Employee over Time 2" (`employee_login_2`); each refusal in the app's own words, a set-up with no free employee is "Not tested" | `src/api/services/overtimeSetUp.ts`, `src/data/overtimeTaker.ts` |

## Next

1. Lead: run `employeeAndLeaves-ts.xml`, `emloyess2-ts.xml`, `invoices-ts.xml`, `overtimeManagement-ts.xml`,
   `overtimeManagementTraps-ts.xml`, `plans-ts.xml` on Test 8094 from Trova (the Test
   project needs the TS suite files next to its `suiteFiles/ts/*-ts.xml`).
2. Every Java suite with blocks is moved; a new Java suite on Test gets its row here and its TS twin the same way.

3. Check-by-check comparison of every Java suite on Test with its TS twin, and what else still needs Java: `docs/java-to-ts-map.md` (2026-11-12).
