package utils;

import java.io.File;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.nio.file.Files;

import static utils.MethodHandlesWeb.test;

/** The rolling dates of a suite run and a test class (split out of {@link UtilsTests}, reached through it). */
public class WorkDateSteps extends WebSessionSteps {

    /**
     * The work day for one whole suite run, rolled forward by one day per run.
     *
     * <p>Stored in {@code data/workDate.txt}, format {@code yyyy-MM-dd}; the first run uses
     * {@code -DworkDateSeed=yyyy-MM-dd}, or today when that is not given:
     * <pre>
     *   1st run: the seed
     *   2nd run: the seed + 1 day
     *   3rd run: the seed + 2 days   ... and so on, whenever it is actually run
     * </pre>
     *
     * <p>This is NOT {@link #getNextDynamicTestDate()}. That one is built once per test class
     * instance, which TestNG makes once per {@code <test>} tag, so a suite with eight blocks would
     * move eight days and every block would look at a different day. This one is built once per run,
     * on the first {@code workDate="auto"}, and handed to every block of the run, which is what a
     * scenario spread over several blocks needs - a run works one day, the next run works the next.
     *
     * <p>Reached from a suite file with {@code <parameter name="workDate" value="auto"/>} - no file
     * has to be edited between runs.
     */
    public String getNextSuiteWorkDate() {
        String seed = System.getProperty("workDateSeed", "");
        return getNextSuiteWorkDate("data/workDate.txt",
                seed.matches("\\d{4}-\\d{2}-\\d{2}") ? seed : LocalDate.now().toString());
    }

    /**
     * Same as {@link #getNextSuiteWorkDate()}, with its own file and first day - for
     * {@code workDate="auto:yyyy-MM-dd"}, e.g. {@code auto:1910-01-01} keeps
     * {@code data/workDate-1910-01-01.txt}: 1st run 1910-01-01, 2nd run 1910-01-02, ...
     */
    public String getNextSuiteWorkDate(String dateFilePath, String seedDate) {
        String next = rollDate(dateFilePath, seedDate);
        System.out.println("🗓️ Work date (this run): " + next);
        return next;
    }

    /**
     * Gets the next test date by incrementing by one day with each execution
     * (data/testDate.txt, first execution 1900-01-11), regardless of when it is run.
     */
    public String getNextDynamicTestDate() {
        String next = rollDate("data/testDate.txt", "1900-01-11");
        System.out.println("🗓️ Test Date (current execution): " + next);
        return next;
    }

    /**
     * Reads the stored day, adds one, writes it back and returns it; a missing file starts at the seed.
     *
     * <p>Jenkins runs a job on whichever of its agents is free, and each agent has its own workspace, so
     * the date files would split into one counter per agent and two agents would hand out the same day.
     * {@code -DdateDir=<folder>} makes every agent use one folder instead, and the file is locked while
     * it is read and written, so two runs at the same moment still get different days. The first run
     * with a new {@code dateDir} continues from the workspace's own {@code data/} file when there is one.
     */
    private static String rollDate(String dateFilePath, String seedDate) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        File local = new File(dateFilePath);
        String dir = System.getProperty("dateDir", "");
        File file = dir.isBlank() || dir.startsWith("${") ? local : new File(dir, local.getName());
        try {
            if (file.getParentFile() != null) {
                file.getParentFile().mkdirs();
            }
            try (java.io.RandomAccessFile raf = new java.io.RandomAccessFile(file, "rw");
                 java.nio.channels.FileLock ignored = raf.getChannel().lock()) {
                byte[] bytes = new byte[(int) raf.length()];
                raf.readFully(bytes);
                String last = new String(bytes).trim();
                if (last.isEmpty() && !file.equals(local) && local.isFile()) {
                    last = new String(Files.readAllBytes(local.toPath())).trim();
                }
                LocalDate next = last.isEmpty()
                        ? LocalDate.parse(seedDate, formatter)
                        : LocalDate.parse(last, formatter).plusDays(1);
                System.out.println(last.isEmpty()
                        ? "📁 First run - starting from " + seedDate + " (" + file + ")"
                        : "📁 Last run used " + last + " → this run uses " + next.format(formatter) + " (" + file + ")");
                raf.setLength(0);
                raf.write(next.format(formatter).getBytes());
                return next.format(formatter);
            }
        } catch (IOException e) {
            System.out.println("❌ Error reading/writing " + file + ". Using " + seedDate + ".");
            e.printStackTrace();
            return seedDate;
        }
    }
}
