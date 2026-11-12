package utils;

import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Omar 2026-10-25: before test 1 of a Trova run - are the logins there, do the environment's browser-storage entries
 * ("New design" ...) go in, is each saved sign-in still good? One that ran out (its own end time, or saved over 6 hours
 * ago with no end time in it) is not put back: the run's first block signs in on the screen once, up front, so tests do
 * not get stuck on a sign-in page later. Plain lines in the run's console; nothing here knows the app.
 */
final class RunPreFlight {

    static final long STALE_MS = 6L * 60 * 60 * 1000;
    private static volatile boolean done;

    private RunPreFlight() {
    }

    /** once per run, in a Trova run only (its live folder is set) */
    static void check() {
        if (done || System.getProperty("liveDir", "").isBlank()) return;
        done = true;
        try {
            Set<String> logins = Credentials.logins();
            System.out.println(logins.isEmpty()
                    ? "Before test 1: no login is saved for this environment - a test that signs in will stop (Test Data → Credentials)"
                    : "Before test 1: logins ready - " + String.join(", ", logins));
            List<String> storage = new ArrayList<>();
            for (BrowserStorage.Item i : BrowserStorage.all()) storage.add(i.note() != null && !i.note().isBlank() ? i.note() : i.name());
            if (!storage.isEmpty()) System.out.println("Before test 1: browser storage goes in before the first page - " + String.join(", ", storage));
            for (String login : KeptSignIn.logins()) System.out.println("Before test 1: " + signIn(login));
        } catch (Exception e) {
            System.out.println("Before test 1: the check could not finish (" + e.getClass().getSimpleName() + ") - the tests go on");
        }
    }

    /** the plain line for one kept sign-in; a run-out one is marked stale */
    static String signIn(String login) {
        // Omar 2026-10-25: API first - the recipe signs in once; a kept state is only the fallback, never a screen sign-in
        if (ApiSignIn.has(login)) return login + " signs in by the app's own sign-in calls, once for the whole run";
        JsonObject state = KeptSignIn.state(login);
        if (state == null) return "no sign-in recipe and no saved sign-in for " + login + " - a test that signs in as " + login + " stops";
        SignInClock.End end = SignInClock.of(state);
        JsonObject raw = KeptSignIn.raw(login);
        long savedAt = raw != null && raw.has("savedAt") ? raw.get("savedAt").getAsLong() : 0;
        if (stale(end, savedAt, System.currentTimeMillis())) {
            KeptSignIn.stale(login);
            return "the saved sign-in for " + login + " ran out - a test that signs in as " + login + " stops (no sign-in recipe yet)";
        }
        if (renewSoon(end, System.currentTimeMillis())) { // Omar 2026-10-25: renewed before test 1, never in the middle of a test
            KeptSignIn.renew(login);
            return "the saved sign-in for " + login + " runs out " + end.words() + " - renewing it once now, before the tests";
        }
        return end.at() > 0 ? "the saved sign-in for " + login + " is still good (runs out " + end.words() + ")"
                : "the saved sign-in for " + login + " is recent";
    }

    static final long RENEW_MS = 30L * 60 * 1000;

    /** Omar 2026-10-25: still good, but runs out within 30 min - a suite may take that long */
    static boolean renewSoon(SignInClock.End end, long now) {
        return end.at() > 0 && end.at() - now < RENEW_MS;
    }

    /** ran out by its own end time, or (no end time) saved more than 6 hours ago */
    static boolean stale(SignInClock.End end, long savedAt, long now) {
        if (end.at() > 0) return end.expired();
        return savedAt > 0 && now - savedAt > STALE_MS;
    }
}
