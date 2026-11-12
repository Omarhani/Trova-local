package utils;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Omar 2026-10-25 - "Log in programmatically" by API, for any app: the login's sign-in recipe from Test Data →
 * Programmatically (the app's own sign-in calls, learned by Trova; data/credentials.json "signInApi") runs ONCE per run
 * with the login's fields from Test Data → Credentials (the code step takes the code saved there). Its answer gives the
 * browser keys (local / session storage, cookies) and the token every API set-up and clean-up of the run uses. Never
 * prints a value.
 */
public final class ApiSignIn {

    /** what one API sign-in gives: the token and the browser keys {localStorage: {}, sessionStorage: {}, cookies: {}} */
    public record Result(String token, Map<String, Map<String, String>> browser) {
    }

    private static final Gson GSON = new Gson();
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();
    private static final Map<String, Result> DONE = new ConcurrentHashMap<>();
    private static final Map<String, String> REFUSED = new ConcurrentHashMap<>();
    private static JsonObject recipes;

    private ApiSignIn() {
    }

    /** true when Test Data has a sign-in recipe for this login on the run's environment */
    public static boolean has(String login) {
        return recipe(login) != null;
    }

    /** the run's one API sign-in as {@code login} (later calls get the same); throws with the app's reason in plain words */
    public static synchronized Result signIn(String login) {
        String k = key(login);
        if (REFUSED.containsKey(k)) throw new IllegalStateException(REFUSED.get(k));
        Result kept = DONE.get(k);
        if (kept != null) return kept;
        try {
            Result fresh = SharedSignIn.of(login); // Omar 2026-10-27: the one sign-in Trova shares with the AI run / other tries
            if (fresh != null) {
                DONE.put(k, fresh);
                System.out.println("Signed in as " + login + " with the sign-in Trova shares for this login (no new code asked)");
                return fresh;
            }
            fresh = runWaitOnce(login);
            DONE.put(k, fresh);
            System.out.println("Signed in as " + login + " by the app's own sign-in calls (no sign-in page)");
            return fresh;
        } catch (RuntimeException e) {
            REFUSED.put(k, e.getMessage()); // never a second try this run: repeated refusals can lock the account
            throw e instanceof IllegalStateException ? e : new IllegalStateException(e.getMessage(), e);
        }
    }

    /** Omar 2026-10-27: the values the run's API sign-in as {@code login} kept (e.g. USER_ID); empty when it did not sign in by API */
    public static Map<String, String> values(String login) {
        Result r = DONE.get(key(login));
        Map<String, String> out = new java.util.HashMap<>();
        if (r != null && r.browser() != null) r.browser().values().forEach(m -> { if (m != null) out.putAll(m); });
        return out;
    }

    /** the token of the run's API sign-in, or null when the run did not sign in by API as {@code login} */
    public static String token(String login) {
        Result r = DONE.get(key(login));
        return r == null ? null : r.token();
    }

    /** the login's recipe, or null */
    static JsonObject recipe(String login) {
        JsonObject all = load();
        for (Map.Entry<String, JsonElement> e : all.entrySet()) {
            if (e.getKey().equalsIgnoreCase(String.valueOf(login).trim()) && e.getValue().isJsonObject()
                    && e.getValue().getAsJsonObject().has("calls")) return e.getValue().getAsJsonObject();
        }
        return null;
    }

    /** a new run (tests of this class): nothing signed in yet */
    static void clear() {
        DONE.clear();
        REFUSED.clear();
    }

    /** Omar 2026-10-27: the app asked to wait (a code asked too soon) - wait 75 s once and try once more */
    private static Result runWaitOnce(String login) {
        try {
            return run(login);
        } catch (IllegalStateException e) {
            if (!SignInRefusal.codeTooSoon(e.getMessage())) throw e;
            System.out.println("The app asked to wait before a new code - waiting 75 s, then one more try");
            try {
                Thread.sleep(75_000);
            } catch (InterruptedException stop) {
                Thread.currentThread().interrupt();
                throw e;
            }
            return run(login);
        }
    }

    private static Result run(String login) {
        return runOn(login, recipe(login), TestData.apiUrl());
    }

    /** Omar 2026-10-27: a recipe's calls on {@code base} (the phone app's sign-in runs them on the mobile API) */
    static Result runOn(String login, JsonObject recipe, String base) {
        if (recipe == null) throw new IllegalStateException("Trova has no sign-in recipe for \"" + login + "\" on " + TestData.env());
        Map<String, String> fields = Credentials.of(login);
        String codeField = recipe.has("codeField") ? recipe.get("codeField").getAsString() : null;
        if (codeField != null && TestData.isProd() && !ApiSignInRecipe.present(GSON.toJsonTree(ApiSignInRecipe.field(fields, codeField)))) {
            throw new IllegalStateException("The Prod environment has no test code for \"" + login + "\" - Trova does not sign in by API"
                    + " there; save a real sign-in for it in Test Data → Programmatically, or run on a test environment");
        }
        JsonObject transforms = recipe.has("transforms") ? recipe.getAsJsonObject("transforms") : new JsonObject();
        JsonObject kept = new JsonObject();
        java.util.function.Function<String, String> field = names -> {
            String v = ApiSignInRecipe.field(fields, names);
            if (v == null) throw new IllegalStateException("The login \"" + login + "\" has no " + names.split("\\|")[0]
                    + " - add it in Test Data → Credentials");
            return v;
        };
        int n = 0;
        for (JsonElement c : recipe.getAsJsonArray("calls")) {
            JsonObject call = c.getAsJsonObject();
            JsonElement answer = call(recipe, call, field, kept, transforms, ++n, base);
            if (call.has("keep")) {
                call.getAsJsonObject("keep").entrySet().forEach(e -> {
                    JsonElement v = ApiSignInRecipe.at(answer, e.getValue().getAsString());
                    if (v != null) kept.add(e.getKey(), v);
                });
            }
            if (call.has("doneWhen") && ApiSignInRecipe.present(kept.get(call.get("doneWhen").getAsString()))) break;
        }
        return new Result(token(recipe, kept), browser(recipe, field, kept, transforms));
    }

    private static JsonElement call(JsonObject recipe, JsonObject call, java.util.function.Function<String, String> field,
                                    JsonObject kept, JsonObject transforms, int n, String base) {
        String method = call.has("method") ? call.get("method").getAsString().toUpperCase() : "POST";
        String path = call.get("path").getAsString();
        HttpRequest.Builder req = HttpRequest.newBuilder(URI.create(url(recipe, path, base))).timeout(Duration.ofSeconds(60))
                .header("Content-Type", "application/json").header("Accept", "application/json");
        TestData.apiHeadersForOneCall().forEach(req::header);
        if (call.has("headers")) {
            JsonObject h = ApiSignInRecipe.fill(call.get("headers"), field, kept, transforms).getAsJsonObject();
            h.entrySet().forEach(e -> req.setHeader(e.getKey(), ApiSignInRecipe.plain(e.getValue())));
        }
        String body = call.has("body") ? GSON.toJson(ApiSignInRecipe.fill(call.get("body"), field, kept, transforms)) : null;
        req.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
        HttpResponse<String> res;
        try {
            res = HTTP.send(req.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("The app's sign-in call " + n + " (" + path + ") did not answer: " + e.getClass().getSimpleName());
        }
        if (res.statusCode() >= 400) {
            throw new IllegalStateException(SignInRefusal.words(ScreenSignIn.appName(TestData.webUrl()),
                    path + " answered HTTP " + res.statusCode(), true));
        }
        JsonElement answer;
        try {
            answer = res.body() == null || res.body().isBlank() ? new JsonObject() : JsonParser.parseString(res.body());
        } catch (Exception e) {
            answer = new com.google.gson.JsonPrimitive(res.body());
        }
        refused(call, answer, path);
        return answer;
    }

    /** "refusedWhen": the app said no in its own answer (HTTP 200 with Status false ...) - its own words */
    private static void refused(JsonObject call, JsonElement answer, String path) {
        if (!call.has("refusedWhen")) return;
        JsonObject w = call.getAsJsonObject("refusedWhen");
        JsonElement v = ApiSignInRecipe.at(answer, w.get("field").getAsString());
        if (v == null || !v.isJsonPrimitive() || !v.getAsJsonPrimitive().toString().equals(w.get("is").toString())) return;
        JsonElement said = w.has("say") ? ApiSignInRecipe.at(answer, w.get("say").getAsString()) : null;
        throw new IllegalStateException(SignInRefusal.words(ScreenSignIn.appName(TestData.webUrl()),
                "The app refused the call " + path + ": " + ApiSignInRecipe.plain(said), true));
    }

    private static String token(JsonObject recipe, JsonObject kept) {
        String name = recipe.has("token") ? recipe.get("token").getAsString() : null;
        JsonElement v = name == null ? null : kept.get(name);
        return ApiSignInRecipe.present(v) ? ApiSignInRecipe.plain(v) : null;
    }

    private static Map<String, Map<String, String>> browser(JsonObject recipe, java.util.function.Function<String, String> field,
                                                           JsonObject kept, JsonObject transforms) {
        Map<String, Map<String, String>> out = new LinkedHashMap<>();
        out.put("localStorage", new LinkedHashMap<>());
        out.put("sessionStorage", new LinkedHashMap<>());
        out.put("cookies", new LinkedHashMap<>());
        if (!recipe.has("browser")) return out;
        for (JsonElement b : recipe.getAsJsonArray("browser")) {
            JsonObject o = b.getAsJsonObject();
            if (PageSettings.ifMissing(o)) continue; // Omar 2026-10-27: page settings go in only when missing (PageSettings)
            JsonElement v = o.has("from") ? kept.get(o.get("from").getAsString())
                    : ApiSignInRecipe.fill(o.get("value"), field, kept, transforms);
            if (v == null || v.isJsonNull()) continue;
            String text = "json".equals(o.has("as") ? o.get("as").getAsString() : "text") ? GSON.toJson(v) : ApiSignInRecipe.plain(v);
            out.computeIfAbsent(o.get("place").getAsString(), p -> new LinkedHashMap<>()).put(o.get("key").getAsString(), text);
        }
        return out;
    }

    /** the API address + the call's path ("apiRoot": added only when the address does not end with it already) */
    static String url(JsonObject recipe, String path) {
        return url(recipe, path, TestData.apiUrl());
    }

    static String url(JsonObject recipe, String path, String apiBase) {
        if (path.matches("(?i)^https?://.*")) return path;
        String base = (apiBase == null ? "" : apiBase).replaceAll("/+$", "");
        if (base.isBlank()) throw new IllegalStateException("No API address for " + TestData.env() + " - add it in Test Data → Environments");
        String root = recipe.has("apiRoot") ? recipe.get("apiRoot").getAsString().replaceAll("^/+|/+$", "") : "";
        String p = path.replaceAll("^/+", "");
        boolean add = !root.isEmpty() && !base.toLowerCase().endsWith("/" + root.toLowerCase()) && !p.toLowerCase().startsWith(root.toLowerCase() + "/");
        return base + "/" + (add ? root + "/" : "") + p;
    }

    private static synchronized JsonObject load() {
        if (recipes != null) return recipes;
        String fromEnv = System.getenv("FIA_CREDENTIALS_FILE");
        Path file = Path.of(System.getProperty("credentialsFile", fromEnv != null && !fromEnv.isBlank() ? fromEnv : "data/credentials.json"));
        try {
            JsonElement root = Files.isRegularFile(file) ? JsonParser.parseString(Files.readString(file, StandardCharsets.UTF_8)) : null;
            JsonElement s = root != null && root.isJsonObject() ? root.getAsJsonObject().get("signInApi") : null;
            recipes = s != null && s.isJsonObject() ? s.getAsJsonObject() : new JsonObject();
        } catch (Exception e) {
            recipes = new JsonObject();
        }
        return recipes;
    }

    private static String key(String login) {
        return String.valueOf(login).trim().toLowerCase();
    }
}
