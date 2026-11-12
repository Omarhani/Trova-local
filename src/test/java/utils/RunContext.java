package utils;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * What one {@code <test>} block of a suite hands to the next: TestNG makes a new test class instance per block,
 * so a value made in block 1 (the user created by API, a booking id) is lost unless it is kept here.
 *
 * <pre>
 * &lt;test name="Create booking by API"&gt;   -> RunContext.put("bookingId", id)
 * &lt;test name="Check it on the web"&gt;      -> RunContext.get("bookingId")
 * &lt;test name="Clean up - delete it"&gt;     -> RunContext.remove("bookingId")
 * </pre>
 *
 * The "current user" is the one a suite made for itself (e.g. a user signed up by API): the phone's saved login
 * ({@link MobileSession}) is kept per server and user, so BaseTests asks here which user the run is on.
 * Everything is cleared when a new suite starts.
 */
public final class RunContext {

    private static final Map<String, Object> VALUES = new ConcurrentHashMap<>();
    private static volatile String currentUser;
    private static volatile String notMade;

    private RunContext() {
    }

    public static void put(String key, Object value) {
        VALUES.put(key, value);
    }

    @SuppressWarnings("unchecked")
    public static <T> T get(String key) {
        T value = (T) VALUES.get(key);
        if (value == null) {
            String reason = notMade; // Omar 2026-10-27 (runs 248 / 256): a set-up made no record = the test is skipped with its reason
            if (reason != null) throw new org.testng.SkipException(reason);
            throw new IllegalStateException("Nothing saved as \"" + key + "\" in this run - the block that makes it"
                    + " must run first (check the suite's <test> order and whether that block failed)");
        }
        return value;
    }

    /** Omar 2026-10-26: what is kept now (a copy) - utils.SetupHandOver checks a set-up kept something */
    public static Map<String, Object> snapshot() {
        return new java.util.HashMap<>(VALUES);
    }

    public static boolean has(String key) {
        return VALUES.containsKey(key);
    }

    public static void remove(String key) {
        VALUES.remove(key);
    }

    /** Omar 2026-10-27: a data set-up of this run made no record - its "Not tested - needs <record>" reason (SetupHandOver) */
    public static void setupMadeNothing(String reason) {
        notMade = reason;
    }

    /** The user this run made for itself / logs in with, or null. */
    public static String currentUser() {
        return currentUser;
    }

    public static void setCurrentUser(String userName) {
        currentUser = userName;
    }

    public static void clear() {
        VALUES.clear();
        currentUser = null;
        notMade = null;
    }
}
