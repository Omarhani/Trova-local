package base;

import org.openqa.selenium.WebDriver;
import utils.UtilsTests;

import java.time.LocalDate;

/** The day a scenario works on: pinned, today, or rolled forward one day per run. */
final class WorkDays {

    /**
     * Rolled forward one day per run ({@code data/workDate.txt}). Built on the first
     * {@code workDate="auto"}, so only the suites that ask for it move the file.
     */
    private static String suiteWorkDate;

    /** This run's day per {@code workDate="auto:yyyy-MM-dd"} seed, each rolled in its own file. */
    private static final java.util.Map<String, String> seededSuiteWorkDates = new java.util.HashMap<>();

    private WorkDays() {
    }

    /** A new suite picks its work day again, on the first workDate="auto" of the run. */
    static void reset() {
        suiteWorkDate = null;
        seededSuiteWorkDates.clear();
    }

    /** workDate is not empty here: see {@link BaseTests#workDate}. */
    static String of(String workDate, WebDriver driver) {
        if (workDate.trim().equalsIgnoreCase("today") || workDate.trim().matches("\\$\\{workDateFor\\w+}")) {
            return LocalDate.now().toString();
        }
        if (workDate.trim().equalsIgnoreCase("auto")) {
            synchronized (WorkDays.class) {
                if (suiteWorkDate == null) {
                    suiteWorkDate = new UtilsTests(driver).getNextSuiteWorkDate();
                }
            }
            return suiteWorkDate;
        }
        if (workDate.trim().matches("(?i)auto:\\d{4}-\\d{2}-\\d{2}")) {
            String seed = workDate.trim().substring(5);
            synchronized (WorkDays.class) {
                return seededSuiteWorkDates.computeIfAbsent(seed, s ->
                        new UtilsTests(driver).getNextSuiteWorkDate("data/workDate-" + s + ".txt", s));
            }
        }
        return workDate.trim();
    }
}
