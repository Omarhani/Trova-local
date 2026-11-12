package utils;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.openqa.selenium.Cookie;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * The modes of the web app saved in FIA (Test Data → Browser storage): cookies and local / session storage values that
 * put the app in the right mode - e.g. "New design" = local storage {@code old} = {@code new}. In a web test's set-up,
 * after opening the app's address:
 * <pre>
 *   driver.get(webUrl);
 *   BrowserStorage.apply(driver);   // sets them for this site and reloads the page
 * </pre>
 * The FIA runner writes them for the run's environment next to the logins - the file {@link Credentials} reads
 * ({@code data/credentials.json}, {@code -DcredentialsFile=<path>} or {@code FIA_CREDENTIALS_FILE}), key "storage" -
 * and deletes the file after the run. No file (a local run) = no values: {@link #apply} then does nothing.
 */
public final class BrowserStorage {

    /** type: COOKIE, LOCAL (local storage) or SESSION (session storage); domain / path: cookies only, null = this site / "/". */
    public record Item(String type, String name, String value, String domain, String path, String note) {
    }

    private static List<Item> items;

    private BrowserStorage() {
    }

    /** Every value of this run's environment, in the order FIA keeps them. */
    public static List<Item> all() {
        return load();
    }

    /**
     * Sets every value on the page the driver is on (open the app's address first: cookies and storage belong to a
     * site), then reloads the page so the app starts in that mode. Does nothing when there is none.
     */
    public static void apply(WebDriver driver) {
        List<Item> list = load();
        if (list.isEmpty()) {
            return;
        }
        for (Item item : list) {
            if ("COOKIE".equals(item.type())) {
                Cookie.Builder cookie = new Cookie.Builder(item.name(), item.value())
                        .path(item.path() == null || item.path().isBlank() ? "/" : item.path());
                if (item.domain() != null && !item.domain().isBlank()) {
                    cookie.domain(item.domain());
                }
                driver.manage().addCookie(cookie.build());
            } else {
                String store = "SESSION".equals(item.type()) ? "sessionStorage" : "localStorage";
                String value = item.value();
                // Trova DEF-364: an app that keeps its text values as JSON ("light", "new" - with the quotes) cannot read a bare
                // new and may stop on a spinner. When the value is not JSON and the app's own storage holds text that way,
                // it is saved in the app's style.
                Object wrap = ((JavascriptExecutor) driver).executeScript(
                        "var s = window[arguments[0]]; try { JSON.parse(arguments[1]); return false; } catch (e) {}"
                                + "for (var i = 0; i < s.length; i++) { try { if (typeof JSON.parse(s.getItem(s.key(i))) === 'string') return true; } catch (e) {} }"
                                + "return false;", store, value);
                if (Boolean.TRUE.equals(wrap)) {
                    value = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
                    System.out.println("Browser storage: " + item.name() + " saved in the app's own style (text with quotes)");
                }
                ((JavascriptExecutor) driver).executeScript("window[arguments[0]].setItem(arguments[1], arguments[2]);", store, item.name(), value);
                written.put(store + "|" + item.name(), value);
            }
        }
        driver.navigate().refresh();
        checkStayed(driver, list);
    }

    /**
     * Omar 2026-10-25: the values went in with the one-shot script before the first and only page load - read them back
     * only (no write, no reload) and warn when the app dropped one.
     */
    public static void stayed(WebDriver driver) {
        List<Item> list = load();
        if (!list.isEmpty()) checkStayed(driver, list);
    }

    /** what each storage value was set to (store|name → value), for the read-back after the reload */
    private static final java.util.Map<String, String> written = new java.util.HashMap<>();

    /**
     * Trova DEF-403 - after the reload, each value is read back: one the app removed or changed is a warning on the run
     * page (a live "warn" event), so a wrong or ignored value never passes silently.
     */
    private static void checkStayed(WebDriver driver, List<Item> list) {
        try {
            for (Item item : list) {
                String label = ("COOKIE".equals(item.type()) ? "cookie " : "SESSION".equals(item.type()) ? "session storage " : "local storage ")
                        + item.name();
                String now;
                String expected;
                if ("COOKIE".equals(item.type())) {
                    Cookie c = driver.manage().getCookieNamed(item.name());
                    now = c == null ? null : c.getValue();
                    expected = item.value();
                } else {
                    String store = "SESSION".equals(item.type()) ? "sessionStorage" : "localStorage";
                    Object v = ((JavascriptExecutor) driver).executeScript("return window[arguments[0]].getItem(arguments[1]);", store, item.name());
                    now = v == null ? null : String.valueOf(v);
                    expected = written.getOrDefault(store + "|" + item.name(), item.value());
                }
                if (now == null) {
                    warn("Browser storage " + label + " did not stay - the app removed it after the page loaded");
                } else if (!now.equals(expected)) {
                    warn("Browser storage " + label + " did not stay - the app changed it from " + expected + " to " + now);
                }
            }
        } catch (Exception e) {
            System.out.println("Browser storage could not be checked: " + e.getMessage());
        }
    }

    /** A warning the run page shows (Trova reads "@@live" lines from the run's console). */
    private static void warn(String text) {
        System.out.println("⚠ " + text);
        com.google.gson.JsonObject event = new com.google.gson.JsonObject();
        event.addProperty("t", "warn");
        event.addProperty("at", System.currentTimeMillis());
        event.addProperty("text", text);
        StringBuilder ascii = new StringBuilder();
        for (char ch : event.toString().toCharArray()) {
            if (ch < 128) ascii.append(ch); else ascii.append(String.format("\\u%04x", (int) ch));
        }
        System.out.println("@@live " + ascii);
    }

    private static synchronized List<Item> load() {
        if (items != null) {
            return items;
        }
        String fromEnv = System.getenv("FIA_CREDENTIALS_FILE"); TrovaRun.require(); // TICKET-1021: only a run Trova started
        Path file = Path.of(System.getProperty("credentialsFile",
                fromEnv != null && !fromEnv.isBlank() ? fromEnv : "data/credentials.json"));
        List<Item> all = new ArrayList<>();
        if (Files.isRegularFile(file)) {
            try {
                JsonObject root = JsonParser.parseString(Files.readString(file, StandardCharsets.UTF_8)).getAsJsonObject();
                if (root.has("storage") && root.get("storage").isJsonArray()) {
                    for (JsonElement e : root.getAsJsonArray("storage")) {
                        JsonObject s = e.getAsJsonObject();
                        all.add(new Item(text(s, "type"), text(s, "name"), text(s, "value") == null ? "" : text(s, "value"),
                                text(s, "domain"), text(s, "path"), text(s, "note")));
                    }
                }
            } catch (IOException | RuntimeException e) {
                throw new IllegalStateException("Could not read " + file + ": " + e.getMessage(), e);
            }
        }
        items = Collections.unmodifiableList(all);
        return items;
    }

    private static String text(JsonObject o, String key) {
        return o.has(key) && !o.get(key).isJsonNull() ? o.get(key).getAsString() : null;
    }
}
