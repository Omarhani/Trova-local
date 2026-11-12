package utils;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;

import java.util.List;
import java.util.regex.Pattern;

/**
 * TICKET-982 (Omar 2026-10-23): a toast / snackbar / alert often holds its close button ("×", "✕", "X") in the same
 * element, so its whole text reads "Saved successfully×" and an equals check fails. Assert on the MESSAGE only:
 * {@link #visibleMessage(WebElement)} reads the toast without its close button; {@link #withoutClose(String)} cleans a
 * text already read. Never assert equals on the whole toast container.
 */
public final class UiText {

    /** close glyphs at either end only ("2 × 3" stays) */
    private static final Pattern GLYPHS = Pattern.compile("^[\\s×✕✖✗]+|[\\s×✕✖✗]+$");
    /** the close button inside a toast: a button, an aria-label / class with close or dismiss */
    private static final By CLOSE_BUTTON = By.xpath(".//button | .//*[@role='button'] | .//*[contains(translate(@aria-label,"
            + "'CLOSEDISM','closedism'),'close') or contains(translate(@aria-label,'CLOSEDISM','closedism'),'dismiss')"
            + " or contains(@class,'close') or contains(@class,'dismiss')]");

    private UiText() {
    }

    /** the toast's message: its whole text minus the close button's own text, the close glyphs dropped, trimmed */
    public static String visibleMessage(WebElement toast) {
        if (toast == null) return "";
        String text = toast.getText() == null ? "" : toast.getText();
        try {
            List<WebElement> buttons = toast.findElements(CLOSE_BUTTON);
            for (WebElement b : buttons) {
                String own = b.getText() == null ? "" : b.getText().strip();
                if (!own.isEmpty() && own.length() <= 12 && text.contains(own)) {
                    int at = text.lastIndexOf(own);
                    text = text.substring(0, at) + text.substring(at + own.length());
                }
            }
        } catch (RuntimeException ignored) {
            // the toast went while it was read: its text as it was
        }
        return withoutClose(text);
    }

    /** "Saved successfully×" / "Saved successfully\n✕" → "Saved successfully"; spaces made single, trimmed */
    public static String withoutClose(String text) {
        if (text == null) return "";
        String t = GLYPHS.matcher(text).replaceAll("").replaceAll("\\s+", " ").strip();
        if (t.length() > 2 && (t.endsWith(" x") || t.endsWith(" X"))) t = t.substring(0, t.length() - 2).strip();
        return t;
    }

    /** a toast check that never fails on the close button: the message has the expected text in it */
    public static boolean shows(WebElement toast, String expected) {
        return visibleMessage(toast).contains(withoutClose(expected));
    }

}
