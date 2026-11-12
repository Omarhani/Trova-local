package utils;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.openqa.selenium.WebDriver;

import java.net.URI;
import java.util.List;

/**
 * Omar 2026-10-25: Test Data → Browser storage (the app's modes, e.g. "New design" = local storage {@code old}) goes in
 * BEFORE the app's first page in every run - suite runs, single tests, AI runs and the writer's tries - on top of the
 * kept sign-in's full state (same name = the Test Data entry wins). After that ONE page load they are only read back
 * ({@link BrowserStorage#stayed}) - no second write, no reload (Omar 2026-10-25: the app loaded twice).
 */
final class StorageModes {

    private StorageModes() {
    }

    /** true when the run's environment has browser-storage entries */
    static boolean any() {
        return !BrowserStorage.all().isEmpty();
    }

    /** a copy of {@code state} (null = an empty one for {@code url}'s site) with the run's entries on top */
    static JsonObject onTop(JsonObject state, String url) {
        JsonObject out = state == null ? empty(url) : state.deepCopy();
        List<BrowserStorage.Item> items = BrowserStorage.all();
        for (BrowserStorage.Item item : items) {
            if ("COOKIE".equals(item.type())) {
                JsonArray cookies = place(out, "cookies").isJsonArray() ? out.getAsJsonArray("cookies") : new JsonArray();
                JsonArray kept = new JsonArray();
                for (JsonElement c : cookies) {
                    if (!item.name().equals(c.getAsJsonObject().get("name").getAsString())) kept.add(c);
                }
                JsonObject c = new JsonObject();
                c.addProperty("name", item.name());
                c.addProperty("value", item.value());
                c.addProperty("path", item.path() == null || item.path().isBlank() ? "/" : item.path());
                if (item.domain() != null && !item.domain().isBlank()) c.addProperty("domain", item.domain());
                kept.add(c);
                out.add("cookies", kept);
            } else {
                String store = "SESSION".equals(item.type()) ? "sessionStorage" : "localStorage";
                JsonObject values = place(out, store).isJsonObject() ? out.getAsJsonObject(store) : new JsonObject();
                values.addProperty(item.name(), item.value());
                out.add(store, values);
            }
        }
        return out;
    }

    /** opens {@code url} with only the run's entries in the browser before the app starts (no sign-in) */
    static void open(WebDriver driver, String url) {
        BrowserState.restore(driver, url, onTop(null, url));
        BrowserStorage.stayed(driver); // read back only: a warning on the run page when the app dropped one
    }

    private static JsonElement place(JsonObject o, String key) {
        return o.has(key) ? o.get(key) : new JsonObject();
    }

    private static JsonObject empty(String url) {
        URI target = URI.create(url);
        JsonObject o = new JsonObject();
        o.addProperty("origin", target.getScheme() + "://" + target.getAuthority());
        o.addProperty("at", url);
        o.add("localStorage", new JsonObject());
        o.add("sessionStorage", new JsonObject());
        o.add("cookies", new JsonArray());
        return o;
    }
}
