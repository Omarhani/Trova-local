package utils;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Omar 2026-10-27 (session 270: the side menu still unstyled - the login's sign-in was learned before Trova kept the
 * page settings): when a login's sign-in recipe has no page settings yet, they are read ONCE now - the app opened signed
 * out with nothing in the browser, what its sign-in page writes is read - used at once as set-if-missing, and left for
 * the runner to add to the recipe (target/trova-sessions), so the next runs need no extra visit.
 */
final class PageSettingsCapture {

    private static final Pattern SECRET_KEY = Pattern.compile("(?i)(token|jwt|auth|session|secret|password|pass|otp|user|account|refresh)");
    private static final Pattern SECRET_VALUE = Pattern.compile("^[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}$|^[A-Za-z0-9+/=_-]{40,}$");
    private static final Pattern THIRD_PARTY = Pattern.compile("(?i)^(__mpq|mp_|_ga|_gid|_gcl|_grecaptcha|amplitude|ajs_|_hj|intercom|lr-|_lr|_fbp|__stripe|optimizely|_dd)");

    private PageSettingsCapture() {
    }

    private static final Map<String, Map<String, Map<String, String>>> READ = new java.util.concurrent.ConcurrentHashMap<>();

    /** the recipe's settings, or - once per run and login, when the recipe was never read for them - the ones read now */
    static Map<String, Map<String, String>> orRead(WebDriver driver, String url, String login, Map<String, Map<String, String>> settings) {
        String k = String.valueOf(login).trim().toLowerCase(java.util.Locale.ROOT);
        if (READ.containsKey(k)) return READ.get(k);
        if (known(login)) return settings;
        Map<String, Map<String, String>> now = read(driver, url, login);
        READ.put(k, now);
        return now;
    }

    /** true when the recipe was already read for page settings (it has some, or "pageKeysRead") */
    static boolean known(String login) {
        JsonObject recipe = ApiSignIn.recipe(login);
        if (recipe == null) return true; // no recipe: nothing to add to
        JsonElement read = recipe.get("pageKeysRead");
        return (read != null && read.isJsonPrimitive() && read.getAsBoolean()) || !PageSettings.of(login).isEmpty();
    }

    /** opens the app signed out once, reads what it wrote, cleans the browser again; place → key → value (empty when none) */
    static Map<String, Map<String, String>> read(WebDriver driver, String url, String login) {
        Map<String, Map<String, String>> out = new LinkedHashMap<>();
        try {
            BrowserState.restore(driver, url, new JsonObject()); // nothing in: the app shows its sign-in page
            JavascriptExecutor js = (JavascriptExecutor) driver;
            for (int t = 0; t < 15000 && !"complete".equals(js.executeScript("return document.readyState")); t += 300) pause(300);
            pause(2000); // the page writes its settings just after it loads
            for (String place : new String[] {"localStorage", "sessionStorage"}) {
                @SuppressWarnings("unchecked")
                Map<String, Object> kv = (Map<String, Object>) js.executeScript("try { return Object.assign({}, window[arguments[0]]); } catch (e) { return {}; }", place);
                Map<String, String> keep = new LinkedHashMap<>();
                if (kv != null) kv.forEach((k, v) -> { if (setting(k, v == null ? null : String.valueOf(v))) keep.put(k, String.valueOf(v)); });
                if (!keep.isEmpty()) out.put(place, keep);
            }
            BrowserState.clear(driver);
            KeptSignIn.keepPageKeys(login, out);
            System.out.println("Read the page settings of the sign-in page once for " + login
                    + (out.isEmpty() ? " - it writes none" : " (" + out.values().stream().mapToInt(Map::size).sum() + ") - kept for the next runs"));
        } catch (RuntimeException e) {
            System.out.println("The page settings of the sign-in page could not be read this time - the run goes on");
        }
        return out;
    }

    static boolean setting(String key, String value) {
        return key != null && !key.isBlank() && value != null && value.length() <= 200 && !SECRET_KEY.matcher(key).find()
                && !THIRD_PARTY.matcher(key).find() && !SECRET_VALUE.matcher(value).find();
    }

    private static void pause(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
