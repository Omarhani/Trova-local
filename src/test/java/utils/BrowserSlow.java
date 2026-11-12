package utils;

/**
 * Omar 2026-10-25 (suite "Failed test cases": "timeout: Timed out receiving message from renderer" was reported as
 * "Sign-in did not work" and every later test skipped): a browser that is slow to answer is not a refused sign-in. The
 * step is tried once more ("The browser was slow - retried once"); a second slow answer fails only this step, never
 * marks the login refused.
 */
public final class BrowserSlow {

    /** the words a slow browser answers with */
    public static final String SLOW = "The browser was slow";

    private BrowserSlow() {
    }

    /** true when {@code e} (or a cause) is the browser timing out, not the app refusing anything */
    public static boolean is(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause() == t ? null : t.getCause()) {
            if (t instanceof org.openqa.selenium.TimeoutException) return true;
            String m = t.getMessage();
            if (m != null && (m.contains("Timed out receiving message from renderer") || m.contains("timeout: Timed out")
                    || m.contains("cannot determine loading status") || m.contains("Read timed out"))) return true;
        }
        return false;
    }

    /** runs {@code step}; a slow browser = said once and tried once more; a second slow answer throws a plain slow reason */
    public static void retryOnce(Runnable step) {
        try {
            step.run();
        } catch (RuntimeException e) {
            if (!is(e)) throw e;
            System.out.println(SLOW + " - retried once");
            try {
                step.run();
            } catch (RuntimeException again) {
                if (!is(again)) throw again;
                throw new IllegalStateException(SLOW + " - retried once, it was still slow", again);
            }
        }
    }
}
