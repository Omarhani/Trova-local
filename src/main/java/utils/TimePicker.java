package utils;

import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.Keys;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.interactions.Actions;

import java.util.List;
import java.util.Locale;

/**
 * Omar 2026-10-30 (AI sessions 418-423, Availo Plans / shifts at /calendar-shifts): a time field is SET in one call -
 * TimePicker.set(driver, field, "18:00", 10, "Shift start"). A field that takes typing gets the time typed; a read-only
 * field opens its clock dialog (big "10 : 11" header, round face, AM / PM, Cancel / OK): AM / PM first, then the hour
 * header and its place on the face, then the minute header and its place - each checked in the header and tried again
 * (at most 3) - then OK, and the field is read back until it shows the time. Every session before worked this out by hand.
 */
public final class TimePicker {

    /** the clock dialog on top: Angular Material style (mat-clock / a time-frame header) */
    static final By DIALOG = By.xpath("(//*[self::mat-dialog-container or @role='dialog'][.//mat-clock or .//*[contains(@class,'time-frame')]])[last()]");
    private static final String HEADER = ".time-frame span.time, .time-frame .time";
    private static final String HALVES = ".ampm span, .ampm button, .ampm div";
    private static final String FACE = "mat-clock .circle, .clock-face, mat-clock";
    private static final String NUMBERS = "mat-clock button.number, button.number";
    private static final String ACTIONS = "mat-dialog-actions button, .mat-dialog-actions button, .actions button";
    private static final List<String> OK_WORDS = List.of("ok", "save", "set", "done", "حفظ", "موافق", "تم");
    private static final double FALLBACK_RADIUS = 108; // Omar 2026-10-30: Availo's numbers sit 108 px from the face's centre

    private TimePicker() {
    }

    /** sets the time field at {@code field} to {@code time} ("18:00", "6:30 pm"); returns what the field shows then */
    public static String set(WebDriver driver, By field, String time) {
        return set(driver, field, time, 10, null);
    }

    /** the same, with the field's name for a plain failure ("The Shift start field shows \"\" after choosing 6:00 pm") */
    public static String set(WebDriver driver, By field, String time, int seconds, String name) {
        ClockTime want = ClockTime.parse(time);
        int s = Math.max(1, seconds);
        String what = name == null || name.isBlank() ? "The time field" : "The " + name.strip() + " field";
        PageReady.await(driver, s);
        WebElement input = WaitedReads.within(driver, s * 1000L, 200,
                d -> d.findElements(field).stream().filter(WebElement::isDisplayed).findFirst().orElse(null));
        if (input == null) throw new AssertionError(what + " was not on the screen within " + s + " s");
        Covers.waitGone(driver);
        if (takesTyping(input)) type(driver, input, time.strip(), want);
        else pick(driver, input, want, s, what);
        String[] shown = {""};
        WaitedReads.within(driver, s * 1000L, 200, d -> {
            String v = d.findElement(field).getAttribute("value");
            shown[0] = v == null ? "" : v.strip();
            return want.matches(shown[0]) ? Boolean.TRUE : null;
        });
        if (!want.matches(shown[0])) throw new AssertionError(what + " shows \"" + shown[0] + "\" after choosing " + want);
        return shown[0];
    }

    /** a plain or native time input (not read-only, no clock dialog behind it) */
    static boolean takesTyping(WebElement input) {
        String readonly = input.getAttribute("readonly");
        boolean ro = readonly != null && !"false".equalsIgnoreCase(readonly);
        return !ro && input.getAttribute("mattimepicker") == null;
    }

    private static void type(WebDriver driver, WebElement input, String text, ClockTime want) {
        if ("time".equalsIgnoreCase(input.getAttribute("type"))) { // Omar 2026-10-30: a native time box takes HH:mm by script
            ((JavascriptExecutor) driver).executeScript("arguments[0].value = arguments[1];"
                    + "arguments[0].dispatchEvent(new Event('input', {bubbles: true}));"
                    + "arguments[0].dispatchEvent(new Event('change', {bubbles: true}));", input,
                    String.format(Locale.ROOT, "%02d:%02d", want.hour24(), want.minute()));
            return;
        }
        input.clear(); // wait-ok: found shown just before
        input.sendKeys(Keys.chord(Keys.CONTROL, "a"), Keys.DELETE);
        WaitedReads.typeWhenReady(driver, input, 5, text, Keys.TAB);
    }

    private static void pick(WebDriver driver, WebElement input, ClockTime want, int s, String what) {
        WaitedReads.clickWhenReady(driver, input, s);
        if (!WaitedReads.isShownWithin(driver, DIALOG, s)) throw new AssertionError(what + "'s clock did not open within " + s + " s");
        boolean twelve = half(driver, want);
        int hour = twelve ? want.hour12() : want.hour24();
        String hourHeader = twelve ? want.hourHeader() : String.format(Locale.ROOT, "%02d", want.hour24());
        face(driver, 0, hour % 12 == 0 ? 12 : hour % 12, 12, !twelve && want.innerRing24(), hourHeader, what + "'s clock hour");
        face(driver, 1, want.minute(), 60, false, want.minuteHeader(), what + "'s clock minute");
        WebElement ok = okButton(driver.findElement(DIALOG));
        if (ok == null) throw new AssertionError(what + "'s clock has no OK button");
        WaitedReads.clickWhenReady(driver, ok, s);
        if (!WaitedReads.isGoneWithin(driver, DIALOG, s)) throw new AssertionError(what + "'s clock did not close after OK");
    }

    /** clicks AM / PM when the clock has them; false = a 24-hour clock */
    private static boolean half(WebDriver driver, ClockTime want) {
        List<WebElement> halves = driver.findElement(DIALOG).findElements(By.cssSelector(HALVES));
        for (WebElement h : halves) {
            String t = h.getText().strip().toLowerCase(Locale.ROOT);
            boolean pm = t.equals("pm") || t.equals("م");
            boolean am = t.equals("am") || t.equals("ص");
            if ((pm && want.pm()) || (am && !want.pm())) {
                WaitedReads.clickWhenReady(driver, h, 5);
                return true;
            }
        }
        return halves.stream().anyMatch(h -> !h.getText().isBlank());
    }

    /** header {@code part} (0 hour, 1 minute) chosen, then {@code value} out of {@code full} clicked on the face, until the header shows it */
    private static void face(WebDriver driver, int part, int value, int full, boolean inner, String header, String what) {
        for (int attempt = 1; attempt <= 3; attempt++) {
            List<WebElement> heads = driver.findElement(DIALOG).findElements(By.cssSelector(HEADER));
            if (heads.size() > part) WaitedReads.clickWhenReady(driver, heads.get(part), 5);
            WebElement face = WaitedReads.within(driver, 5000, 150, d -> d.findElement(DIALOG).findElements(By.cssSelector(FACE))
                    .stream().filter(WebElement::isDisplayed).findFirst().orElse(null));
            if (face == null) throw new AssertionError(what + ": the clock face did not show");
            double radius = radius(driver, face) * (inner ? 0.62 : 1);
            int[] at = ClockTime.offset(value, full, radius);
            new Actions(driver).moveToElement(face, at[0], at[1]).click().perform(); // wait-ok: the face is shown just above
            Boolean done = WaitedReads.within(driver, 3000, 150, d -> {
                List<WebElement> h = d.findElement(DIALOG).findElements(By.cssSelector(HEADER));
                return h.size() > part && h.get(part).getText().strip().equals(header) ? Boolean.TRUE : null;
            });
            if (done != null) return;
        }
        throw new AssertionError(what + " did not show " + header + " after 3 tries");
    }

    /** how far the numbers sit from the face's centre: measured on its "12" / "00", else 108 px */
    private static double radius(WebDriver driver, WebElement face) {
        try {
            for (WebElement n : driver.findElement(DIALOG).findElements(By.cssSelector(NUMBERS))) {
                String t = n.getText().strip();
                if (!t.equals("12") && !t.equals("00")) continue;
                double fx = face.getRect().x + face.getRect().width / 2.0, fy = face.getRect().y + face.getRect().height / 2.0;
                double nx = n.getRect().x + n.getRect().width / 2.0, ny = n.getRect().y + n.getRect().height / 2.0;
                double r = Math.hypot(nx - fx, ny - fy);
                if (r > 20) return r;
            }
        } catch (RuntimeException redrawn) { // Omar 2026-10-30: the face re-draws between hours and minutes - the known size then
            return FALLBACK_RADIUS;
        }
        return FALLBACK_RADIUS;
    }

    private static WebElement okButton(WebElement dialog) {
        List<WebElement> buttons = dialog.findElements(By.cssSelector(ACTIONS));
        for (WebElement b : buttons)
            if (OK_WORDS.contains(b.getText().strip().toLowerCase(Locale.ROOT))) return b;
        return buttons.isEmpty() ? null : buttons.get(buttons.size() - 1); // Omar 2026-10-30: OK is the last action (Cancel, OK)
    }
}
