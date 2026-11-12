package utils;

import java.util.ArrayList;
import java.util.List;

/**
 * Omar 2026-10-27 (the tests turned Overtime ON in the settings and never back): every setting a run changes is put back
 * by its clean-up, and a record the run made that cannot be deleted is said in plain words.
 *
 * <pre>
 * // set-up or test, BEFORE the change: what it was and how to put it back
 * PutBack.setting("Overtime in Attendance settings", wasOn, () -> settings.setOvertime(wasOn));
 * settings.setOvertime(true);
 * // clean-up (always runs): every change back, the newest first; then the records
 * PutBack.all();
 * PutBack.notDeleted("overtime request", "it was approved - the app does not delete a decided request");
 * </pre>
 */
public final class PutBack {

    private record Change(String name, Object before, Runnable restore) {
    }

    private static final List<Change> CHANGES = new ArrayList<>();

    private PutBack() {
    }

    /** remembers a setting before it changes; only the first value per setting is kept (the one the run found) */
    public static synchronized void setting(String name, Object before, Runnable restore) {
        if (CHANGES.stream().anyMatch(c -> c.name().equalsIgnoreCase(name))) return;
        CHANGES.add(new Change(name, before, restore));
    }

    /** puts every remembered setting back, the newest first; one plain line each; never stops the clean-up */
    public static synchronized List<String> all() {
        List<String> said = new ArrayList<>();
        for (int i = CHANGES.size() - 1; i >= 0; i--) {
            Change c = CHANGES.get(i);
            try {
                c.restore().run();
                said.add("Put back: " + c.name() + " (" + shown(c.before()) + ")");
            } catch (RuntimeException e) {
                said.add("Could not put back " + c.name() + " to " + shown(c.before()) + " - set it by hand");
            }
        }
        CHANGES.clear();
        said.forEach(System.out::println);
        return said;
    }

    /** a record of this run the app does not let the clean-up delete - said in plain words */
    public static void notDeleted(String what, String why) {
        System.out.println("Not deleted: the " + what + " made by this run - " + (why == null || why.isBlank() ? "the app did not allow it" : why));
    }

    private static String shown(Object v) {
        if (v instanceof Boolean b) return b ? "on" : "off";
        return v == null ? "empty" : String.valueOf(v);
    }
}
