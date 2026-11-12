package utils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * The ids a run made, per kind, kept in {@link RunContext} so the clean-up block deletes exactly those:
 * {@code RunIds.keep("orderIds", id)} in the set-up / test, {@code RunIds.newestFirst("orderIds")} in the clean-up.
 */
public final class RunIds {

    private RunIds() {
    }

    public static void keep(String key, String id) {
        List<String> ids = RunContext.has(key) ? RunContext.get(key) : new ArrayList<>();
        ids.add(id);
        RunContext.put(key, ids);
    }

    /** Every id kept under the key, the newest first (children before parents); empty when none. */
    public static List<String> newestFirst(String key) {
        List<String> ids = RunContext.has(key) ? new ArrayList<>(RunContext.<List<String>>get(key)) : new ArrayList<>();
        Collections.reverse(ids);
        return ids;
    }

    /** Takes one id off the list after it was deleted (by a test that deletes it itself). */
    public static void forget(String key, String id) {
        if (RunContext.has(key)) {
            RunContext.<List<String>>get(key).remove(id);
        }
    }
}
