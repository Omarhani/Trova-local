package utils;

import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;
import java.util.List;

/**
 * Omar 2026-10-26 (session 48, case "details of a pending request": the date was checked against the hours field): a
 * value on a details view or in a table is read by its LABEL / COLUMN HEADER, never by its position. {@link #byLabel}
 * finds the label's text (either language) and returns the value next to it; {@link #byColumn} returns the cell of
 * the column whose header has that text, in the row that holds {@code rowText}. Empty string = not found.
 */
public final class LabelledValues {

    private static final String BY_LABEL = """
            var want = arguments[0].map(function (w) { return w.trim().toLowerCase(); });
            function txt(e) { return (e.innerText || e.textContent || '').replace(/\\s+/g, ' ').trim(); }
            var all = document.querySelectorAll('label, dt, th, span, div, p, strong, b, td');
            for (var i = 0; i < all.length; i++) {
              var e = all[i], t = txt(e).replace(/[:：]\\s*$/, '').toLowerCase();
              if (want.indexOf(t) < 0 || e.offsetParent === null) continue;
              var id = e.getAttribute('for'); if (id && document.getElementById(id)) { var f = document.getElementById(id); return (f.value || txt(f)); }
              var n = e.nextElementSibling; if (n && txt(n)) return txt(n);
              var p = e.parentElement; if (p && p.nextElementSibling && txt(p.nextElementSibling)) return txt(p.nextElementSibling);
              if (p) { var rest = txt(p).replace(txt(e), '').replace(/^[:：\\s]+/, '').trim(); if (rest) return rest; }
            }
            return '';""";

    private static final String BY_COLUMN = """
            var table = arguments[0], want = arguments[1].map(function (w) { return w.trim().toLowerCase(); }), row = (arguments[2] || '').toLowerCase();
            function txt(e) { return (e.innerText || e.textContent || '').replace(/\\s+/g, ' ').trim(); }
            var heads = table.querySelectorAll('thead th, [role=columnheader]'), col = -1;
            for (var i = 0; i < heads.length; i++) if (want.indexOf(txt(heads[i]).toLowerCase()) >= 0) { col = i; break; }
            if (col < 0) return '';
            var rows = table.querySelectorAll('tbody tr, [role=row]');
            for (var r = 0; r < rows.length; r++) {
              var cells = rows[r].querySelectorAll('td, [role=cell], [role=gridcell]');
              if (!cells.length || (row && txt(rows[r]).toLowerCase().indexOf(row) < 0)) continue;
              return cells[col] ? txt(cells[col]) : '';
            }
            return '';""";

    private LabelledValues() {
    }

    /** the value shown next to the label (any of {@code labels}: e.g. "Hours", "الساعات"); waits up to {@code seconds} */
    public static String byLabel(WebDriver driver, int seconds, String... labels) {
        return waitFor(driver, seconds, () -> (String) ((JavascriptExecutor) driver).executeScript(BY_LABEL, List.of(labels)));
    }

    /** the cell under the column header (any of {@code headers}) in the first row holding {@code rowText} (null = first row) */
    public static String byColumn(WebDriver driver, By table, String rowText, int seconds, String... headers) {
        return waitFor(driver, seconds, () -> (String) ((JavascriptExecutor) driver).executeScript(BY_COLUMN,
                driver.findElement(table), List.of(headers), rowText == null ? "" : rowText));
    }

    private static String waitFor(WebDriver driver, int seconds, java.util.function.Supplier<String> read) {
        String[] last = {""};
        PageReady.await(driver, Math.max(seconds, PageReady.SWITCH_SECONDS)); // Omar 2026-10-26: the page finishes loading first
        try {
            new WebDriverWait(driver, Duration.ofSeconds(Math.max(1, seconds))).ignoring(RuntimeException.class).until(d -> {
                String v = read.get();
                last[0] = v == null ? "" : v;
                return !last[0].isBlank();
            });
        } catch (org.openqa.selenium.TimeoutException notThere) {
            // the label / column is not on the screen: "" - the check fails with Expected / Actual
        }
        return last[0];
    }
}
