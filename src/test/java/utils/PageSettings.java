package utils;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Omar 2026-10-27: the page settings an app's sign-in page writes BEFORE anyone signs in (theme, language, design mode
 * ...). A browser signed in by API never visits that page, so without them the app can open unstyled. They sit in the
 * login's sign-in recipe as set-if-missing entries ({"place", "key", "value", "ifMissing": true}) and go into the
 * browser state only when the key is not there - never over a kept value or Test Data → Browser storage.
 */
final class PageSettings {

    private PageSettings() {
    }

    /** true for a set-if-missing entry of a recipe's "browser" list */
    static boolean ifMissing(JsonObject entry) {
        JsonElement f = entry == null ? null : entry.get("ifMissing");
        return f != null && f.isJsonPrimitive() && f.getAsBoolean();
    }

    /** the login's set-if-missing entries: place → key → value (empty when its recipe has none) */
    static Map<String, Map<String, String>> of(String login) {
        Map<String, Map<String, String>> out = new LinkedHashMap<>();
        JsonObject recipe = ApiSignIn.recipe(login);
        if (recipe == null || !recipe.has("browser") || !recipe.get("browser").isJsonArray()) return out;
        for (JsonElement b : recipe.getAsJsonArray("browser")) {
            if (!b.isJsonObject() || !ifMissing(b.getAsJsonObject())) continue;
            JsonObject o = b.getAsJsonObject();
            JsonElement v = o.get("value");
            if (!o.has("key") || v == null || v.isJsonNull()) continue;
            String place = o.has("place") ? o.get("place").getAsString() : "localStorage";
            out.computeIfAbsent(place, p -> new LinkedHashMap<>()).put(o.get("key").getAsString(), v.isJsonPrimitive() ? v.getAsString() : v.toString());
        }
        return out;
    }

    /** a copy of {@code state} with each setting added only where its key is missing */
    static JsonObject addMissing(JsonObject state, Map<String, Map<String, String>> settings) {
        if (settings == null || settings.isEmpty()) return state;
        JsonObject out = state.deepCopy();
        for (String place : new String[] {"localStorage", "sessionStorage"}) {
            JsonObject store = out.has(place) && out.get(place).isJsonObject() ? out.getAsJsonObject(place) : new JsonObject();
            settings.getOrDefault(place, Map.of()).forEach((k, v) -> {
                if (!store.has(k)) store.addProperty(k, v);
            });
            out.add(place, store);
        }
        JsonArray cookies = out.has("cookies") && out.get("cookies").isJsonArray() ? out.getAsJsonArray("cookies") : new JsonArray();
        settings.getOrDefault("cookies", Map.of()).forEach((k, v) -> {
            for (JsonElement c : cookies) if (k.equals(c.getAsJsonObject().get("name").getAsString())) return;
            JsonObject c = new JsonObject();
            c.addProperty("name", k);
            c.addProperty("value", v);
            c.addProperty("path", "/");
            cookies.add(c);
        });
        out.add("cookies", cookies);
        return out;
    }
}
