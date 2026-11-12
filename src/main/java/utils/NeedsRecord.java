package utils;

import org.testng.SkipException;

/**
 * Omar 2026-10-25: a test whose precondition names a record ("an employee exists") makes it in its set-up first; when
 * the set-up could not make it the test is skipped with "Not tested - needs <the record>" - never an assertion failure.
 */
public final class NeedsRecord {

    /** Omar 2026-10-26: how many records were confirmed made / found - utils.SetupHandOver reads it */
    private static final java.util.concurrent.atomic.AtomicInteger HANDED = new java.util.concurrent.atomic.AtomicInteger();

    private NeedsRecord() {
    }

    public static int handed() {
        return HANDED.get();
    }

    /** skips the test with the plain reason when {@code made} is false (the set-up did not make the record) */
    public static void made(boolean made, String record) {
        if (!made) throw new SkipException("Not tested - needs " + record);
        HANDED.incrementAndGet();
    }

    /** the same for a set-up that gave back the new record's id / value: null or blank = not made */
    public static <T> T made(T value, String record) {
        made(value != null && !String.valueOf(value).isBlank(), record);
        return value;
    }
}
