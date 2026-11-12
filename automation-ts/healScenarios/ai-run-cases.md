# Self-healing proof - AI-run cases 11 and 12

Omar 2026-11-11. Two test cases run by Trova's AI (not TS code). The Lead creates them in Trova (Availo project, web,
signed in as **Admin**), runs them, and checks each designed end. Same page as the TS proofs: Work plans
(مواعيد الدوام > خطط الدوام). Nothing is saved in the app.

## Case 11 - A learned step whose element changed is healed, the next run needs no AI

**Designed end:** run 2 - the changed step is healed (cause OUR_CODE, change record "element: old -> new"), case PASSED;
run 3 - the same case PASSED with **no AI help** on that step (the healed learned step is used; tokens for it = 0).

| Field | Value |
|---|---|
| Title | Verify that the Work plans page opens from the side menu |
| Set-up | Signed in as Admin on the Availo portal (the run's one sign-in). No record needed. |
| Step 1 | Open the side menu "مواعيد الدوام" (Shift times) |
| Step 2 | Click "خطط الدوام" (Work plans) |
| Step 3 | Click "إضافة خطة جديدة" (Add plan), then close the form without saving |
| Expected | The page title "خطط الدوام" shows; the Add plan form opens and closes; nothing is saved |

**How to trigger:**
1. Run 1 - run the case once as it is; it must PASS and Trova learns its steps (Work plans link, Add plan button).
2. Make the learned element of step 2 stale - the "element changed" on purpose. In Trova open the learned elements of
   the Availo project (App map / learned steps), find "Work plans" on the Work plans page and change its name to
   `خطط الدوام القديمة` (an old name the app does not have). If Trova has no screen to edit a learned element, ask a
   BE dev to change that one learned element's locator the same way (one element, one field; note the old value).
3. Run 2 - the learned step does not find its element; the AI must name OUR_CODE with proof (the menu shows "خطط الدوام"),
   get past, PASS, and record the heal (from `خطط الدوام القديمة` -> `خطط الدوام`).
4. Run 3 - must PASS with no AI help on step 2 (check the step's details and the run's tokens).
5. If the heal waits for approval (auto-save off), approve it after run 2, then run 3.

**Not proven when:** run 2 fails or is blocked, run 3 asks the AI again for step 2, or the heal changed the expected result.

## Case 12 - TRAP: the app is really wrong - Failed fast, never healed

**Designed end:** FAILED at the wrong step, at once (no tries to make it pass; time <= 1.5x its passed twin, case 11 run 3),
cause APP with proof (Expected / Actual), **no heal, no change record, nothing learned** from the step.

| Field | Value |
|---|---|
| Title | Trap - Verify that the Work plans page title reads "خطط العمل الأسبوعية" |
| Set-up | Signed in as Admin on the Availo portal (the run's one sign-in). No record needed. |
| Step 1 | Open the side menu "مواعيد الدوام" (Shift times) |
| Step 2 | Click "خطط الدوام" (Work plans) |
| Expected | The page title reads "خطط العمل الأسبوعية" |

**How to trigger:** nothing to change - the app's real title is "خطط الدوام", so the app shows a value other than the
case expects, as when the app is wrong. Run it after case 11 (its steps are learned, so only the check is new).

**Not proven when:** it passes, ends Blocked, the AI tries other pages or values to make it pass, the expected result
is changed, a heal or change record is made, or the step is learned.

## After both

| Case | Run | Expected end |
|---|---|---|
| 11 | 1 | PASSED, steps learned |
| 11 | 2 (element made stale) | PASSED with AI help, heal recorded (OUR_CODE) |
| 11 | 3 | PASSED, no AI on step 2 |
| 12 | 1 | FAILED fast (APP), no heal |
