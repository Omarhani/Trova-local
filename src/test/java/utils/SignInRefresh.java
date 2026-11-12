package utils;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Trova (Omar 2026-10-23, Test 8094 run 115) - a kept sign-in whose token ran out, made good again from the project's
 * API sign-in without the sign-in page: the kept state stays whole (theme, language, design mode, every other key), and
 * each key the API sign-in gave a value for gets that new value (same name = same key; a name the kept state does not
 * have is added). Learned generically: nothing here knows the app. Values are never printed.
 */
final class SignInRefresh {

    private SignInRefresh() {
    }

    /** the kept state with the API sign-in's values over it; the API's keys are tagged as sign-in keys */
    static JsonObject merged(JsonObject kept, Map<String, Map<String, String>> api, String url) {
        JsonObject out = kept == null ? base(url) : kept.deepCopy();
        JsonArray tags = out.has("signIn") && out.get("signIn").isJsonArray() ? out.getAsJsonArray("signIn") : new JsonArray();
        Set<String> tagged = new HashSet<>();
        tags.forEach(t -> tagged.add(t.getAsJsonObject().get("place").getAsString() + "\n" + t.getAsJsonObject().get("key").getAsString()));
        for (String place : new String[] {"localStorage", "sessionStorage"}) {
            JsonObject store = out.has(place) && out.get(place).isJsonObject() ? out.getAsJsonObject(place) : new JsonObject();
            api.getOrDefault(place, Map.of()).forEach((k, v) -> {
                if (v == null) return;
                store.addProperty(k, v);
                tag(tags, tagged, place, k);
            });
            out.add(place, store);
        }
        JsonArray cookies = out.has("cookies") && out.get("cookies").isJsonArray() ? out.getAsJsonArray("cookies") : new JsonArray();
        api.getOrDefault("cookies", Map.of()).forEach((k, v) -> {
            if (v == null) return;
            JsonObject same = null;
            for (JsonElement c : cookies) if (k.equals(c.getAsJsonObject().get("name").getAsString())) same = c.getAsJsonObject();
            if (same == null) {
                same = new JsonObject();
                same.addProperty("name", k);
                same.addProperty("path", "/");
                cookies.add(same);
            }
            same.add("value", new JsonPrimitive(v));
            tag(tags, tagged, "cookies", k);
        });
        out.add("cookies", cookies);
        out.add("signIn", tags);
        return out;
    }

    private static JsonObject base(String url) {
        java.net.URI target = java.net.URI.create(url);
        JsonObject state = new JsonObject();
        state.addProperty("origin", target.getScheme() + "://" + target.getAuthority());
        state.addProperty("at", url);
        return state;
    }

    private static void tag(JsonArray tags, Set<String> tagged, String place, String key) {
        if (!tagged.add(place + "\n" + key)) return;
        JsonObject t = new JsonObject();
        t.addProperty("place", place);
        t.addProperty("key", key);
        tags.add(t);
    }
}
