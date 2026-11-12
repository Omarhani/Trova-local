package utils;

import java.util.logging.Filter;
import java.util.logging.Logger;

/**
 * Omar 2026-11-06 (run 209): every Chrome start printed "Unable to find CDP implementation matching 157". Selenium says
 * it when it has no DevTools classes for that Chrome version; Trova's helpers never use them (they send DevTools
 * commands through the driver itself), so the line only confused the run's console. Only those two notes are dropped.
 */
public final class CdpNotice {

    private static final Filter DROP = r -> r.getMessage() == null
            || !(r.getMessage().startsWith("Unable to find CDP implementation") || r.getMessage().startsWith("Unable to find version of CDP"));
    private static volatile boolean installed;
    /** held here: Java forgets a logger nobody holds, and its filter with it */
    private static final java.util.List<Logger> HELD = new java.util.ArrayList<>();

    private CdpNotice() {
    }

    public static void quiet() {
        if (installed) return;
        installed = true;
        for (String name : new String[]{"org.openqa.selenium.devtools.CdpVersionFinder", "org.openqa.selenium.chromium.ChromiumDriver"}) {
            Logger logger = Logger.getLogger(name);
            logger.setFilter(DROP);
            HELD.add(logger);
        }
    }
}
