package utils;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Trova (Omar 2026-10-27) - the ONE sign-in Trova made for this login and environment, shared with everything running at
 * the same time (an AI run, a writer's try, a suite run): data/credentials.json "signInShared". The run uses it instead
 * of asking the app for a new one-time code itself (two code requests at once: "Can't resend before the last code expired").
 */
final class SharedSignIn {

    /** section ("signInShared" / "signInSharedPhone") → login → its shared sign-in */
    private static final Map<String, JsonObject> SHARED = new java.util.concurrent.ConcurrentHashMap<>();

    private SharedSignIn() {
    }

    /** the shared sign-in of {@code login}; null when Trova made none; throws with the reason when Trova's sign-in was refused */
    static ApiSignIn.Result of(String login) {
        return of(login, "signInShared");
    }

    /** Omar 2026-10-27: the ONE phone sign-in Trova shares for {@code login} ("signInSharedPhone"); null when Trova made none */
    static ApiSignIn.Result phone(String login) {
        return of(login, "signInSharedPhone");
    }

    private static ApiSignIn.Result of(String login, String section) {
        JsonObject one = find(login, section);
        if (one == null) return null;
        if (one.has("why") && !one.has("browser")) {
            throw new IllegalStateException(SignInRefusal.words(ScreenSignIn.appName(TestData.webUrl()), one.get("why").getAsString(), true));
        }
        if (!one.has("browser") || !one.get("browser").isJsonObject()) return null;
        Map<String, Map<String, String>> browser = new LinkedHashMap<>();
        for (String place : new String[] {"localStorage", "sessionStorage", "cookies"}) {
            Map<String, String> keys = new LinkedHashMap<>();
            JsonElement p = one.getAsJsonObject("browser").get(place);
            if (p != null && p.isJsonObject()) p.getAsJsonObject().entrySet().forEach(e -> keys.put(e.getKey(),
                    e.getValue().isJsonNull() ? null : e.getValue().isJsonPrimitive() ? e.getValue().getAsString() : e.getValue().toString()));
            browser.put(place, keys);
        }
        String token = one.has("token") && !one.get("token").isJsonNull() ? one.get("token").getAsString() : null;
        return new ApiSignIn.Result(token, browser);
    }

    private static JsonObject find(String login, String section) {
        JsonObject all = load(section);
        for (Map.Entry<String, JsonElement> e : all.entrySet()) {
            if (e.getKey().equalsIgnoreCase(String.valueOf(login).trim()) && e.getValue().isJsonObject()) return e.getValue().getAsJsonObject();
        }
        return null;
    }

    private static synchronized JsonObject load(String section) {
        JsonObject shared = SHARED.get(section);
        if (shared != null) return shared;
        String fromEnv = System.getenv("FIA_CREDENTIALS_FILE");
        Path file = Path.of(System.getProperty("credentialsFile", fromEnv != null && !fromEnv.isBlank() ? fromEnv : "data/credentials.json"));
        try {
            JsonElement root = Files.isRegularFile(file) ? JsonParser.parseString(Files.readString(file, StandardCharsets.UTF_8)) : null;
            JsonElement s = root != null && root.isJsonObject() ? root.getAsJsonObject().get(section) : null;
            shared = s != null && s.isJsonObject() ? s.getAsJsonObject() : new JsonObject();
        } catch (Exception e) {
            shared = new JsonObject();
        }
        SHARED.put(section, shared);
        return shared;
    }
}
