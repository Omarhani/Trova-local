package utils;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Omar 2026-10-25: before every action, the layers that cover the page while it works (loading layer, spinner, busy
 * mask) must be gone - wait until they are invisible (a few seconds), then act. The usual ones are known here; an app's
 * own overlay (from the page map) is added once by its page class: {@code Covers.add(By.cssSelector(".app-loader"))}.
 * Never a drawer or a dialog: those are what the test works in. Never fails - a layer still there after the wait is
 * left to the action (it then asks for AI help as before).
 */
public final class Covers {

    /** loading layers of the common UI kits - only while shown */
    private static final List<By> KNOWN = List.of(
            By.cssSelector(".ngx-spinner-overlay"), By.cssSelector("ngx-spinner .overlay"), By.cssSelector(".loading-overlay"),
            By.cssSelector(".loader-overlay"), By.cssSelector(".page-loader"), By.cssSelector(".blockUI.blockOverlay"),
            By.cssSelector(".k-loading-mask"), By.cssSelector(".ant-spin-spinning"), By.cssSelector(".el-loading-mask"),
            By.cssSelector(".v-overlay--active .v-progress-circular"), By.cssSelector("mat-progress-spinner"),
            By.cssSelector("mat-spinner"), By.cssSelector(".MuiCircularProgress-root"), By.cssSelector("[aria-busy='true'].overlay"));
    private static final List<By> OWN = new CopyOnWriteArrayList<>();
    private static final long WAIT_MS = 5000, STEP_MS = 150;

    private Covers() {
    }

    /** an app's own covering layer (from the page map) - every action waits for it too */
    public static void add(By cover) {
        if (cover != null && !OWN.contains(cover)) OWN.add(cover);
    }

    /** waits up to 5 s until no covering layer is shown; returns at once when none is */
    public static void waitGone(WebDriver driver) {
        if (driver == null) return;
        long until = System.currentTimeMillis() + WAIT_MS;
        while (shown(driver) && System.currentTimeMillis() < until) {
            try {
                Thread.sleep(STEP_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    /** a loading layer is shown now (PageReady waits on it too) */
    static boolean shown(WebDriver driver) {
        try {
            for (List<By> list : List.of(OWN, KNOWN)) {
                for (By by : list) {
                    for (WebElement e : driver.findElements(by)) {
                        if (e.isDisplayed()) return true;
                    }
                }
            }
        } catch (RuntimeException gone) {
            return false; // the page changed under the look - the action's own wait decides
        }
        return false;
    }
}
