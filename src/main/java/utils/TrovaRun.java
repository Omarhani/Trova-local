package utils;

import java.lang.reflect.InvocationTargetException;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * TICKET-1021: suites run only through Trova. Before the first login, test data or browser storage is read, the closed
 * Trova core (com.trova.core.RunGate, loaded only from the compiled jar the runner gives each run in TROVA_CORE_JAR - not part of this
 * project) checks the run's one-time pass with Trova. Without it the run stops with "Run this suite from Trova".
 * Trova's AI sessions (their data file outside the project, FIA_CREDENTIALS_FILE, and no run pass) go on as before.
 */
public final class TrovaRun {

    public static final String REFUSAL = "Run this suite from Trova";
    private static volatile boolean checked;

    private TrovaRun() {
    }

    /** Passes once per run, else IllegalStateException in plain words. */
    public static synchronized void require() {
        if (checked) return;
        String pass = System.getenv("TROVA_RUN_PASS");
        String sessionFile = System.getenv("FIA_CREDENTIALS_FILE");
        if ((pass == null || pass.isBlank()) && sessionFile != null && !sessionFile.isBlank()) {
            checked = true; // an AI session's own run of its tests
            return;
        }
        if ((pass == null || pass.isBlank()) && OldRunnerTicket.allowed()) {
            checked = true; // a runner older than the pass, while Trova does not require one yet
            return;
        }
        try {
            gate().getMethod("check").invoke(null);
            checked = true;
        } catch (InvocationTargetException e) {
            Throwable why = e.getCause();
            throw why instanceof IllegalStateException ise ? ise : new IllegalStateException(REFUSAL);
        } catch (Exception e) {
            throw new IllegalStateException(REFUSAL);
        }
    }

    /** only from the runner's jar (never a class of the same name in the project): its parent knows the JDK alone */
    private static Class<?> gate() throws Exception {
        String jar = System.getenv("TROVA_CORE_JAR");
        if (jar == null || jar.isBlank() || !Files.isRegularFile(Path.of(jar))) throw new IllegalStateException(REFUSAL);
        URLClassLoader loader = new URLClassLoader(new URL[] {Path.of(jar).toUri().toURL()}, ClassLoader.getPlatformClassLoader());
        return Class.forName("com.trova.core.RunGate", true, loader);
    }
}
