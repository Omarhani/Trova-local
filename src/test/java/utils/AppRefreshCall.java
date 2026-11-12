package utils;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonPrimitive;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Trova TICKET-980 (Omar 2026-10-23) - the app's own "Refresh sign-in" call, learned by Trova from the calls an AI
 * session saw ({method, path, send, take} in data/credentials.json "signInRefresh"): it sends the kept refresh token
 * (the kept key or JSON field with the same name as {@code send}) and its answer's new tokens replace the kept values
 * with the same names - every other kept key (theme, language, design mode ...) stays. Values are never printed; the
 * call does not go into the report (no token in it).
 */
final class AppRefreshCall {

    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();

    private AppRefreshCall() {
    }

    /** true when Trova learned the app's refresh call and the environment has an API address */
    static boolean known() {
        JsonObject call = KeptSignIn.refreshCall();
        return call != null && !call.get("path").getAsString().contains("{") && !TestData.apiUrl().isBlank();
    }

    /**
     * the kept state with the new tokens, or null when it cannot be used here (no refresh token kept, nothing to put
     * back); throws with the app's reason in plain words when the app refused it.
     */
    static JsonObject refresh(JsonObject kept) {
        JsonObject call = KeptSignIn.refreshCall();
        if (call == null || kept == null) return null;
        String send = call.get("send").getAsString();
        String old = find(kept, last(send));
        if (old == null) return null;
        JsonObject body = new JsonObject();
        put(body, send, old);
        String url = TestData.apiUrl().replaceAll("/+$", "") + call.get("path").getAsString();
        HttpRequest.Builder req = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json").header("Accept", "application/json")
                .method(call.has("method") ? call.get("method").getAsString() : "POST", HttpRequest.BodyPublishers.ofString(body.toString()));
        TestData.apiHeadersForOneCall().forEach(req::header);
        String access = accessToken(kept, last(send));
        if (access != null) req.header("Authorization", "Bearer " + access);
        HttpResponse<String> answer;
        try {
            answer = HTTP.send(req.build(), HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            System.out.println("The app's refresh call could not be reached: " + e.getClass().getSimpleName());
            return null;
        }
        if (answer.statusCode() < 200 || answer.statusCode() >= 300) {
            String said = answer.body() == null ? "" : answer.body();
            throw new IllegalStateException(SignInRefusal.words(ScreenSignIn.appName(TestData.webUrl()),
                    said.length() > 300 ? said.substring(0, 300) : said, true));
        }
        JsonElement json;
        try {
            json = JsonParser.parseString(answer.body());
        } catch (Exception e) {
            return null;
        }
        Map<String, String> fresh = new LinkedHashMap<>();
        for (JsonElement t : call.has("take") ? call.getAsJsonArray("take") : new JsonArray()) {
            JsonElement v = at(json, t.getAsString());
            if (v != null && v.isJsonPrimitive() && !v.getAsString().isBlank()) fresh.put(norm(last(t.getAsString())), v.getAsString());
        }
        if (fresh.isEmpty()) return null;
        JsonObject out = kept.deepCopy();
        return replace(out, fresh) ? out : null;
    }

    /** puts each new value where the kept state has the same name: a storage key, a field inside a stored JSON value, a cookie */
    private static boolean replace(JsonObject state, Map<String, String> fresh) {
        boolean any = false;
        for (String place : new String[] {"localStorage", "sessionStorage"}) {
            if (!state.has(place) || !state.get(place).isJsonObject()) continue;
            JsonObject store = state.getAsJsonObject(place);
            for (String key : new HashSet<>(store.keySet())) {
                String v = store.get(key).isJsonPrimitive() ? store.get(key).getAsString() : "";
                if (fresh.containsKey(norm(key))) {
                    store.addProperty(key, fresh.get(norm(key)));
                    any = true;
                } else if (v.strip().startsWith("{")) {
                    try {
                        JsonElement inner = JsonParser.parseString(v);
                        if (swap(inner, fresh, 0)) {
                            store.addProperty(key, inner.toString());
                            any = true;
                        }
                    } catch (Exception ignored) {
                        // not JSON: left as it is
                    }
                }
            }
        }
        if (state.has("cookies") && state.get("cookies").isJsonArray()) {
            for (JsonElement c : state.getAsJsonArray("cookies")) {
                JsonObject o = c.getAsJsonObject();
                String v = fresh.get(norm(o.get("name").getAsString()));
                if (v != null) {
                    o.addProperty("value", v);
                    o.remove("expires"); // the app sets the new end itself
                    any = true;
                }
            }
        }
        return any;
    }

    private static boolean swap(JsonElement node, Map<String, String> fresh, int depth) {
        if (!node.isJsonObject() || depth > 5) return false;
        boolean any = false;
        for (Map.Entry<String, JsonElement> f : node.getAsJsonObject().entrySet()) {
            if (f.getValue().isJsonPrimitive() && fresh.containsKey(norm(f.getKey()))) {
                f.setValue(new JsonPrimitive(fresh.get(norm(f.getKey()))));
                any = true;
            } else {
                any |= swap(f.getValue(), fresh, depth + 1);
            }
        }
        return any;
    }

    /** the kept value named like {@code name} (a storage key, a field in a stored JSON value, a cookie), or null */
    private static String find(JsonObject state, String name) {
        for (String place : new String[] {"localStorage", "sessionStorage"}) {
            if (!state.has(place) || !state.get(place).isJsonObject()) continue;
            for (Map.Entry<String, JsonElement> e : state.getAsJsonObject(place).entrySet()) {
                if (!e.getValue().isJsonPrimitive()) continue;
                String v = e.getValue().getAsString();
                if (norm(e.getKey()).equals(norm(name))) return v;
                String inner = v.strip().startsWith("{") ? field(v, norm(name)) : null;
                if (inner != null) return inner;
            }
        }
        if (state.has("cookies") && state.get("cookies").isJsonArray()) {
            for (JsonElement c : state.getAsJsonArray("cookies")) {
                if (norm(c.getAsJsonObject().get("name").getAsString()).equals(norm(name))) return c.getAsJsonObject().get("value").getAsString();
            }
        }
        return null;
    }

    /** a kept token that is not the refresh one (sent as Bearer: many refresh calls want the old one too) */
    private static String accessToken(JsonObject state, String refreshName) {
        for (String name : new String[] {"accessToken", "access_token", "token", "authToken", "idToken", "jwt"}) {
            if (norm(name).equals(norm(refreshName))) continue;
            String v = find(state, name);
            if (v != null && v.chars().filter(ch -> ch == '.').count() == 2) return v;
        }
        return null;
    }

    private static String field(String json, String name) {
        try {
            return field(JsonParser.parseString(json), name, 0);
        } catch (Exception e) {
            return null;
        }
    }

    private static String field(JsonElement node, String name, int depth) {
        if (!node.isJsonObject() || depth > 5) return null;
        for (Map.Entry<String, JsonElement> f : node.getAsJsonObject().entrySet()) {
            if (f.getValue().isJsonPrimitive() && norm(f.getKey()).equals(name)) return f.getValue().getAsString();
            String inner = field(f.getValue(), name, depth + 1);
            if (inner != null) return inner;
        }
        return null;
    }

    private static JsonElement at(JsonElement node, String dotted) {
        JsonElement at = node;
        for (String part : dotted.split("\\.")) {
            if (at == null || !at.isJsonObject()) return null;
            at = at.getAsJsonObject().get(part);
        }
        return at;
    }

    private static void put(JsonObject body, String dotted, String value) {
        String[] parts = dotted.split("\\.");
        JsonObject at = body;
        for (int i = 0; i < parts.length - 1; i++) {
            if (!at.has(parts[i]) || !at.get(parts[i]).isJsonObject()) at.add(parts[i], new JsonObject());
            at = at.getAsJsonObject(parts[i]);
        }
        at.addProperty(parts[parts.length - 1], value);
    }

    private static String last(String dotted) {
        return dotted.substring(dotted.lastIndexOf('.') + 1);
    }

    /** "refresh_token", "RefreshToken", "refresh-token" → "refreshtoken" */
    private static String norm(String name) {
        return name.toLowerCase().replaceAll("[^a-z0-9]", "");
    }
}
