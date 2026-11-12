package utils;

import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;

import java.util.List;
import java.util.Map;

/**
 * Omar 2026-11-06 (run 209, /calendar-shifts): on a screen smaller than 1920x1080, or with Windows' display scaling,
 * Chrome opened narrower than asked, the app took its small-screen layout and its side menu covered buttons ("Something
 * covered the button"). Every web run's page is now exactly 1920x1080 (or the project's own browser size,
 * {@code -DwindowSize=WxH}), headless or not, through Chrome / Edge's own screen setting; other browsers keep their
 * window size.
 */
public final class BrowserViewport {

    /** Chrome / Edge's DevTools command */
    public interface Cdp {
        Map<String, Object> run(String command, Map<String, Object> values);
    }

    private BrowserViewport() {
    }

    /** a Chrome / Edge just started: its page gets the run's size */
    public static void fix(WebDriver driver) {
        if (driver instanceof org.openqa.selenium.chromium.ChromiumDriver chromium) fix(chromium, chromium::executeCdpCommand);
    }

    public static void fix(JavascriptExecutor js, Cdp cdp) {
        int[] want = size();
        try {
            Object seen = js.executeScript("return [window.innerWidth, window.innerHeight];");
            if (seen instanceof List<?> l && l.size() == 2 && number(l.get(0)) == want[0] && number(l.get(1)) == want[1]) return;
            cdp.run("Emulation.setDeviceMetricsOverride", Map.of("width", want[0], "height", want[1], "deviceScaleFactor", 1, "mobile", false));
        } catch (RuntimeException e) {
            System.out.println("The browser's page size could not be set (" + String.valueOf(e.getMessage()).split("\n")[0] + ")");
        }
    }

    /** 1920x1080, or the project's own size from Trova ({@code -DwindowSize=1366x768}) */
    public static int[] size() {
        String v = System.getProperty("windowSize", "").trim();
        if (v.matches("\\d{3,4}x\\d{3,4}")) {
            String[] p = v.split("x");
            return new int[]{Integer.parseInt(p[0]), Integer.parseInt(p[1])};
        }
        return new int[]{1920, 1080};
    }

    private static long number(Object o) {
        return o instanceof Number n ? n.longValue() : -1;
    }
}
