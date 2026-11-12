package base;

import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;

import java.util.function.Supplier;

/**
 * Omar 2026-11-06 (run 209): every test block started its own Chrome (a few seconds each, and a new live screen).
 * Now one browser serves the whole run: a block of the same browser gets the open one back, cleaned first (other
 * windows closed, cookies and the page's storage gone, a blank page), so each case still starts fresh. A browser that
 * died, another browser type, {@code -DoneBrowser=off} or {@code -DattachBrowser} = a new one, as before. The run's end
 * closes it.
 */
public final class OneBrowser {

    private static WebDriver kept;
    private static String keptFor;

    private OneBrowser() {
    }

    /** the run's browser for this block */
    public static synchronized WebDriver take(String browser, Supplier<WebDriver> start) {
        if (on() && kept != null && browser.equals(keptFor) && alive(kept)) {
            clean(kept);
            return kept;
        }
        close();
        WebDriver started = start.get();
        if (on()) {
            kept = started;
            keptFor = browser;
        }
        return started;
    }

    /** the block ends: true = the browser stays open for the next block (do not quit it) */
    public static synchronized boolean keep(WebDriver driver) {
        return on() && driver != null && driver == kept;
    }

    /** the run ends: the kept browser closes */
    public static synchronized void close() {
        WebDriver d = kept;
        kept = null;
        keptFor = null;
        if (d == null) return;
        try {
            d.quit();
        } catch (RuntimeException ignored) {
            // already gone
        }
    }

    private static boolean on() {
        String attach = System.getProperty("attachBrowser", "").trim();
        return !"off".equalsIgnoreCase(System.getProperty("oneBrowser", "").trim()) && (attach.isEmpty() || attach.startsWith("${"));
    }

    private static boolean alive(WebDriver d) {
        try {
            return !d.getWindowHandles().isEmpty();
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** the last case's traces go: extra windows, the page's storage, every cookie; then a blank page */
    private static void clean(WebDriver d) {
        String first = d.getWindowHandles().iterator().next();
        for (String w : d.getWindowHandles()) {
            if (w.equals(first)) continue;
            d.switchTo().window(w);
            d.close();
        }
        d.switchTo().window(first);
        try {
            ((JavascriptExecutor) d).executeScript("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
        } catch (RuntimeException ignored) {
            // a page without storage
        }
        if (d instanceof org.openqa.selenium.chromium.ChromiumDriver c) {
            String origin = origin(d.getCurrentUrl());
            if (origin != null) c.executeCdpCommand("Storage.clearDataForOrigin", java.util.Map.of("origin", origin, "storageTypes", "all"));
            c.executeCdpCommand("Network.clearBrowserCookies", java.util.Map.of()); // every site's cookies, not only this page's
        }
        d.manage().deleteAllCookies();
        d.get("about:blank");
    }

    private static String origin(String url) {
        try {
            java.net.URI u = java.net.URI.create(url);
            return u.getScheme() != null && u.getScheme().startsWith("http") ? u.getScheme() + "://" + u.getRawAuthority() : null;
        } catch (RuntimeException e) {
            return null;
        }
    }
}
