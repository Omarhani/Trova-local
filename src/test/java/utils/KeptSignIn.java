package utils;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Trova (Omar 2026-10-23) - the sign-ins Trova keeps per project + environment + login: the FULL browser state of the
 * app's origin right after a real sign-in ({origin, at, localStorage: {}, sessionStorage: {}, cookies: [{name, value,
 * domain, path ...}], signIn: [{place, key}]} - signIn tags the keys that came with the sign-in), and the login's saved
 * steps (its "recipe": {url, steps: [{fill, field} | {click} | {wait}], done}) for one screen sign-in when it no longer
 * works. Both come in data/credentials.json ("signIn"); a new one is left in target/trova-sessions for the runner,
 * which sends it to Trova after the run and deletes the file. Never log or report a value read here.
 */
public final class KeptSignIn {

    private static final Gson GSON = new Gson();
    /** this run's newer ones (a screen sign-in in an earlier test) over Trova's */
    private static final Map<String, JsonObject> NEWER = new ConcurrentHashMap<>();
    /** this run's healed sign-in steps over Trova's */
    private static final Map<String, JsonObject> HEALED = new ConcurrentHashMap<>();
    private static JsonObject all;
    /** Omar 2026-10-25: Trova's kept states the pre-flight found run out (RunPreFlight) - never put back */
    private static final java.util.Set<String> STALE = ConcurrentHashMap.newKeySet();
    /** TICKET-980: the app's own refresh call ({method, path, send, take}) or null */
    private static JsonObject refreshCall;

    private KeptSignIn() {
    }

    /** the kept state of this login, or null */
    public static JsonObject state(String login) {
        JsonObject newer = NEWER.get(key(login));
        if (newer != null) return newer;
        if (STALE.contains(key(login))) return null;
        JsonObject one = entry(login);
        JsonElement s = one == null ? null : one.get("session");
        return s != null && s.isJsonObject() && s.getAsJsonObject().has("origin") ? s.getAsJsonObject() : null;
    }

    /** the login's saved sign-in steps, or null */
    public static JsonObject recipe(String login) {
        JsonObject healed = HEALED.get(key(login));
        if (healed != null) return healed;
        JsonObject one = entry(login);
        JsonElement r = one == null ? null : one.get("recipe");
        return r != null && r.isJsonObject() && r.getAsJsonObject().has("steps") ? r.getAsJsonObject() : null;
    }

    /** TICKET-980: the app's "Refresh sign-in" call Trova learned ({method, path, send, take}), or null */
    public static JsonObject refreshCall() {
        load();
        return refreshCall;
    }

    /** Omar 2026-10-25: the pre-flight found Trova's kept state of this login run out - the first block signs in once */
    static void stale(String login) {
        STALE.add(key(login));
    }

    /** Omar 2026-10-25: the pre-flight found it runs out within 30 min - the run's first sign-in renews it */
    static void renew(String login) {
        RENEW.add(key(login));
    }

    /** true when the run's first sign-in should renew this login's kept state (once: then it is fresh) */
    static boolean renewing(String login) {
        return RENEW.remove(key(login));
    }

    private static final java.util.Set<String> RENEW = ConcurrentHashMap.newKeySet();

    /** the logins with a kept entry (state or steps) */
    static java.util.Set<String> logins() {
        return load().keySet();
    }

    /** the raw entry of a login ({session, recipe, savedAt}), or null */
    static JsonObject raw(String login) {
        return entry(login);
    }

    /** forget this run's newer state of a login (it no longer works) */
    public static void drop(String login) {
        NEWER.remove(key(login));
    }

    /** keeps a new state for the rest of this run and leaves it for the runner to send to Trova */
    public static void keep(String login, JsonObject state) {
        NEWER.put(key(login), state);
        leave(login, "state", state, "");
    }

    /** sign-in steps healed on the screen (a box found again by its kind): this run and the next ones use them */
    static void keepRecipe(String login, JsonObject recipe) {
        HEALED.put(key(login), recipe);
        leave(login, "recipe", recipe, "-steps");
    }

    /** Omar 2026-10-27: the page settings the sign-in page wrote (read once) - the runner adds them to the login's recipe */
    static void keepPageKeys(String login, java.util.Map<String, java.util.Map<String, String>> pageKeys) {
        leave(login, "pageKeys", GSON.toJsonTree(pageKeys).getAsJsonObject(), "-page");
    }

    /** a file in target/trova-sessions ({login, environment, state | recipe}) - the runner sends it to Trova after the run */
    private static void leave(String login, String part, JsonObject what, String suffix) {
        try {
            JsonObject file = new JsonObject();
            file.addProperty("login", login);
            file.addProperty("environment", TestData.env());
            file.add(part, what);
            Path out = Path.of("target", "trova-sessions", (TestData.env() + "-" + login).replaceAll("[^A-Za-z0-9._-]", "_") + suffix + ".json");
            Files.createDirectories(out.getParent());
            // Omar 2026-10-25: the runner sends it to Trova at once (while the run goes on) - written whole, then moved in
            Path part0 = out.resolveSibling(out.getFileName() + ".part");
            Files.writeString(part0, GSON.toJson(file), StandardCharsets.UTF_8);
            Files.move(part0, out, java.nio.file.StandardCopyOption.REPLACE_EXISTING, java.nio.file.StandardCopyOption.ATOMIC_MOVE);
        } catch (Exception e) {
            System.out.println("The new sign-in could not be kept for the next runs: " + e.getClass().getSimpleName());
        }
    }

    private static JsonObject entry(String login) {
        JsonObject signIn = load();
        for (Map.Entry<String, JsonElement> e : signIn.entrySet()) {
            if (e.getKey().equalsIgnoreCase(String.valueOf(login).trim()) && e.getValue().isJsonObject()) return e.getValue().getAsJsonObject();
        }
        return null;
    }

    private static synchronized JsonObject load() {
        if (all != null) return all;
        String fromEnv = System.getenv("FIA_CREDENTIALS_FILE");
        Path file = Path.of(System.getProperty("credentialsFile", fromEnv != null && !fromEnv.isBlank() ? fromEnv : "data/credentials.json"));
        try {
            JsonElement root = Files.isRegularFile(file) ? JsonParser.parseString(Files.readString(file, StandardCharsets.UTF_8)) : null;
            JsonElement s = root != null && root.isJsonObject() ? root.getAsJsonObject().get("signIn") : null;
            all = s != null && s.isJsonObject() ? s.getAsJsonObject() : new JsonObject();
            JsonElement r = root != null && root.isJsonObject() ? root.getAsJsonObject().get("signInRefresh") : null;
            refreshCall = r != null && r.isJsonObject() && r.getAsJsonObject().has("path") ? r.getAsJsonObject() : null;
        } catch (Exception e) {
            all = new JsonObject();
        }
        return all;
    }

    private static String key(String login) {
        return String.valueOf(login).trim().toLowerCase();
    }
}
