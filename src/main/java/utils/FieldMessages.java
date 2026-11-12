package utils;

import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import java.util.List;

/**
 * Omar 2026-10-26 (session 50, case "minimum daily overtime above the maximum is refused": the app showed the message
 * under the field but the test read it once right after typing and found nothing): an error / validation message is
 * read by WAITING (bounded) until a non-empty message shows near the field - its form-field error / mat-error / hint
 * area - else any visible validation text on the page. The field is left (blur) first, since many forms show the
 * message only then. Empty string = no message within the time.
 */
public final class FieldMessages {

    private static final String READ = """
            var field = arguments[0];
            var sel = 'mat-error, .mat-error, .mat-mdc-form-field-error, mat-hint.mat-error, .invalid-feedback, .form-error,'
              + ' .field-error, .error-message, .error-msg, .validation-message, .help-block, .text-danger, .is-invalid ~ small,'
              + ' .ant-form-item-explain-error, .p-error, .el-form-item__error, .v-messages__message, [role=alert], [aria-live=assertive]';
            function txt(e) { return (e.innerText || e.textContent || '').replace(/\\s+/g, ' ').trim(); }
            function shown(e) { return e.offsetParent !== null || e.getClientRects().length > 0; }
            function texts(root) {
              var out = [], all = root.querySelectorAll(sel);
              for (var i = 0; i < all.length; i++) { var t = txt(all[i]); if (t && shown(all[i]) && out.indexOf(t) < 0) out.push(t); }
              return out;
            }
            if (field) {
              var ids = (field.getAttribute('aria-describedby') || '').split(/\\s+/);
              for (var k = 0; k < ids.length; k++) { var d = ids[k] && document.getElementById(ids[k]); if (d && shown(d) && txt(d)) return txt(d); }
              var box = field;
              for (var up = 0; up < 5 && box.parentElement; up++) {
                box = box.parentElement;
                var near = texts(box);
                if (near.length) return near.join(' | '); // the nearest box first: its own form-field area
              }
            }
            return texts(document).join(' | ');""";

    private FieldMessages() {
    }

    /** the message shown near {@code field} (null = anywhere on the page), waiting up to {@code seconds}; "" when none */
    public static String near(WebDriver driver, By field, int seconds) {
        PageReady.await(driver, seconds); // Omar 2026-10-26: a saving / loading layer goes first
        leave(driver, field);
        String[] last = {""};
        WaitedReads.within(driver, Math.max(1, seconds) * 1000L, 250, d -> {
            last[0] = read(d, field);
            return last[0].isEmpty() ? null : Boolean.TRUE;
        });
        return last[0];
    }

    /**
     * waits up to {@code seconds} until a message near {@code field} holds {@code expected} (spaces and a trailing dot
     * ignored); returns that message, else the last message seen ("" = none) - for an Expected / Actual check
     */
    public static String shows(WebDriver driver, By field, String expected, int seconds) {
        PageReady.await(driver, seconds); // Omar 2026-10-26: a saving / loading layer goes first
        leave(driver, field);
        String want = clean(expected);
        String[] last = {""};
        WaitedReads.within(driver, Math.max(1, seconds) * 1000L, 250, d -> {
            last[0] = read(d, field);
            return !last[0].isEmpty() && (want.isEmpty() || clean(last[0]).contains(want)) ? Boolean.TRUE : null;
        });
        return last[0];
    }

    private static String read(WebDriver driver, By field) {
        try {
            WebElement el = null;
            if (field != null) {
                List<WebElement> found = driver.findElements(field);
                el = found.isEmpty() ? null : found.get(0);
            }
            Object v = ((JavascriptExecutor) driver).executeScript(READ, el);
            return v == null ? "" : v.toString().trim();
        } catch (RuntimeException notReady) { // page still changing: read again on the next try
            return "";
        }
    }

    /** many forms show a field's message only once it is left: blur it (no click elsewhere, no key) */
    private static void leave(WebDriver driver, By field) {
        if (field == null) return;
        try {
            List<WebElement> found = driver.findElements(field);
            if (found.isEmpty()) return;
            ((JavascriptExecutor) driver).executeScript(
                    "var e = arguments[0]; if (document.activeElement === e) { e.blur(); } else {"
                            + " e.dispatchEvent(new FocusEvent('blur')); e.dispatchEvent(new FocusEvent('focusout', {bubbles: true})); }",
                    found.get(0));
        } catch (RuntimeException ignored) { // the field went away: the message is read anyway
        }
    }

    private static String clean(String s) {
        return s == null ? "" : s.replaceAll("\\s+", " ").trim().replaceAll("[.。!]+$", "").trim();
    }
}
