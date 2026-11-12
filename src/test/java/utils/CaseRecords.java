package utils;

import org.testng.ITestResult;
import org.testng.Reporter;
import org.testng.SkipException;

import java.util.Locale;
import java.util.Map;

/**
 * Omar 2026-10-27 (session 270, run 246: the set-up kept its request under its own keys, the tests read another one and
 * were skipped "needs a pending overtime request made by this run"): the ONE hand-over of a precondition record from a
 * set-up block to the test that uses it - no free-text keys.
 *
 * <pre>
 * // set-up block: one record PER changing test (reject and approve each use one up)
 * CaseRecords.made("testRejectingWithAReason", "a pending overtime request", "overtimeRequests/Create", id);
 * CaseRecords.made("testApprovingAPendingRequest", "a pending overtime request", "overtimeRequests/Create", id2);
 * // or one record every view-only test may read
 * CaseRecords.madeForAll("a pending overtime request", "overtimeRequests/Create", id);
 * // the test
 * String id = CaseRecords.mine("a pending overtime request");
 * </pre>
 *
 * The test is named by its method name or its case title (any case, spaces or not, with or without "test"). A null /
 * blank value = not made: the set-up is skipped "Not tested - needs &lt;record&gt;", and so is every test that needs it.
 * The run page shows only "Pre-condition - API &lt;endpoint&gt;: &lt;action&gt;" - never the id or the values.
 */
public final class CaseRecords {

    private static final String PREFIX = "caseRecord|";
    private static final String ALL = "*";

    private CaseRecords() {
    }

    /** the set-up made {@code value} for one test (its method name or case title); endpoint = the call that made it, or null */
    public static <T> T made(String forTest, String record, String endpoint, T value) {
        NeedsRecord.made(value, record); // null / blank = skipped "Not tested - needs <record>"
        RunContext.put(key(forTest, record), value);
        System.out.println(PreconditionWords.line(endpoint, record));
        return value;
    }

    /** the set-up made {@code value} for every test that reads this record (view-only tests may share one) */
    public static <T> T madeForAll(String record, String endpoint, T value) {
        return made(ALL, record, endpoint, value);
    }

    /** the record the set-up made for the test that runs now (its own one, else the shared one); skipped when none */
    public static <T> T mine(String record) {
        ITestResult now = Reporter.getCurrentTestResult();
        String method = now == null ? null : now.getMethod().getMethodName();
        String block = now == null || now.getTestContext() == null ? null : now.getTestContext().getName();
        return forTest(method, block, record);
    }

    /** the record made for {@code test} (method name), else for its block's case title, else the shared one */
    static <T> T forTest(String method, String block, String record) {
        for (String who : new String[] {method, title(block), ALL}) {
            if (who == null) continue;
            String k = key(who, record);
            if (RunContext.has(k)) return RunContext.get(k);
        }
        T only = onlyOneFor(method, title(block)); // one record for this test under another record name
        if (only != null) return only;
        try {
            RunContext.get(PREFIX + "none"); // throws the set-up's own "Not tested - ..." reason when it made nothing
        } catch (SkipException setUpSaid) {
            throw setUpSaid;
        } catch (IllegalStateException nothing) {
            // no reason kept: the plain one below
        }
        throw new SkipException("Not tested - needs " + plain(record) + " made by this run");
    }

    @SuppressWarnings("unchecked")
    private static <T> T onlyOneFor(String method, String title) {
        Object found = null;
        int n = 0;
        for (Map.Entry<String, Object> e : RunContext.snapshot().entrySet()) {
            if (!e.getKey().startsWith(PREFIX)) continue;
            String who = e.getKey().substring(PREFIX.length()).split("\\|", 2)[0];
            if (who.equals(norm(method)) || (title != null && who.equals(norm(title)))) {
                found = e.getValue();
                n++;
            }
        }
        return n == 1 ? (T) found : null;
    }

    /** "Case 12 - Rejecting with a reason" → "Rejecting with a reason" */
    static String title(String block) {
        if (block == null) return null;
        String t = block.replaceFirst("(?i)^\\s*case\\s+[\\d,\\s]+\\s*[-–:]\\s*", "").trim();
        return t.isEmpty() ? null : t;
    }

    static String key(String test, String record) {
        return PREFIX + (ALL.equals(test) ? ALL : norm(test)) + "|" + normRecord(record);
    }

    /** "A pending overtime request made by this run" and "pending overtime request" are one record */
    static String normRecord(String record) {
        String r = record == null ? "" : record.toLowerCase(Locale.ROOT).replaceAll("\\s*(made|created)\\s+(by|for|in)\\s+this\\s+run.*$", "");
        return r.replaceAll("\\b(a|an|the|one)\\b", "").replaceAll("[^a-z0-9]", "");
    }

    /** lower case letters and digits only, without a leading "test" - a method name and a case title meet */
    static String norm(String text) {
        String n = text == null ? "" : text.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        return n.startsWith("test") && n.length() > 4 ? n.substring(4) : n;
    }

    private static String plain(String record) {
        return record == null || record.isBlank() ? "its record" : record.trim();
    }
}
