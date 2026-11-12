package utils;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Trova (Omar 2026-10-27) - a login signed in the way the PHONE app signs in, on the environment's mobile API address
 * (empty = the API address): for a set-up only that user can make (the employee sends the request from the phone app,
 * the manager decides). The login's phone recipe (data/credentials.json "signInApiPhone", learned by Trova), else the
 * web recipe's calls tried on the mobile API. Once per run per login; a refusal is never tried again. Never prints a value.
 */
public final class PhoneSignIn {

    private static final Map<String, String> TOKENS = new ConcurrentHashMap<>();
    private static final Map<String, String> REFUSED = new ConcurrentHashMap<>();
    /** login → the recipe's callShape filled with the sign-in's keys (headers + envelope), Omar 2026-10-27 */
    private static final Map<String, JsonObject> SHAPES = new ConcurrentHashMap<>();
    /** Omar 2026-10-27: login → the values its sign-in kept (e.g. USER_ID, ACCOUNT_ID) - a request body needs them */
    private static final Map<String, Map<String, String>> VALUES = new ConcurrentHashMap<>();
    /** Omar 2026-10-27: logins signed in again because a needed value was missing - once per run */
    private static final java.util.Set<String> AGAIN = ConcurrentHashMap.newKeySet();
    private static final com.google.gson.Gson GSON = new com.google.gson.Gson();
    private static JsonObject recipes;

    private PhoneSignIn() {
    }

    /** the phone token of {@code login} - send it as "Authorization: Bearer <token>" */
    public static synchronized String bearer(String login) {
        String k = String.valueOf(login).trim().toLowerCase();
        if (REFUSED.containsKey(k)) throw new IllegalStateException(REFUSED.get(k));
        String kept = TOKENS.get(k);
        if (kept != null) return kept;
        JsonObject recipe = phoneRecipe(login);
        if (recipe == null) recipe = ApiSignIn.recipe(login); // no phone sign-in learned: the web calls, tried on the phone API
        try {
            // Omar 2026-10-27 (writer session 269, employee suspended): Trova's ONE shared phone sign-in first - never one per test
            ApiSignIn.Result r = SharedSignIn.phone(login);
            if (r != null) System.out.println("Signed in as " + login + " with the phone sign-in Trova shares (no new sign-in)");
            else {
                r = ApiSignIn.runOn(login, recipe, TestData.mobileApiUrl());
                System.out.println("Signed in as " + login + " the way the phone app does (no sign-in screen)");
            }
            return keep(k, r, recipe);
        } catch (RuntimeException e) {
            String said = String.valueOf(e.getMessage());
            String why = said.startsWith("No phone sign-in known") || said.contains(" refused") ? said
                    : "No phone sign-in known for " + login + " (" + said + ")";
            REFUSED.put(k, why); // never a second try this run: repeated refusals can lock the account
            throw new IllegalStateException(why, e);
        }
    }

    /** a value the login's phone sign-in kept (e.g. "USER_ID", "ACCOUNT_ID"); null when the sign-in did not keep it */
    public static String value(String login, String key) {
        bearer(login);
        Map<String, String> m = VALUES.get(String.valueOf(login).trim().toLowerCase());
        return m == null ? null : m.get(key);
    }

    /** Omar 2026-10-27: every value the login's phone sign-in kept - a known body takes its ids by field name */
    public static Map<String, String> values(String login) {
        bearer(login);
        return new java.util.HashMap<>(VALUES.getOrDefault(String.valueOf(login).trim().toLowerCase(), Map.of()));
    }

    /** keeps the sign-in's token, values and call shape for {@code k}; the token */
    private static String keep(String k, ApiSignIn.Result r, JsonObject recipe) {
        String token = r.token();
        if (token == null || token.isBlank()) throw new IllegalStateException("the sign-in gave no token");
        TOKENS.put(k, token);
        Map<String, String> flat = new java.util.HashMap<>();
        if (r.browser() != null) r.browser().values().forEach(m -> { if (m != null) flat.putAll(m); });
        VALUES.put(k, flat);
        if (recipe != null && recipe.has("callShape") && recipe.get("callShape").isJsonObject()) {
            SHAPES.put(k, shape(recipe.getAsJsonObject("callShape"), r.browser()));
        }
        return token;
    }

    /**
     * Omar 2026-10-27 (writer 290: a shared phone sign-in from before the recipe kept ACCOUNT_ID -> null id -> HTTP 400):
     * a value the phone sign-in must have kept; missing -> one new sign-in on the recipe; still missing -> a plain error.
     */
    public static synchronized String required(String login, String key) {
        String v = value(login, key);
        if (v != null && !v.isBlank()) return v;
        String k = String.valueOf(login).trim().toLowerCase();
        String why = "";
        if (AGAIN.add(k)) { // once per run per login - repeated sign-ins can lock the account
            JsonObject recipe = phoneRecipe(login);
            if (recipe == null) recipe = ApiSignIn.recipe(login);
            try {
                keep(k, ApiSignIn.runOn(login, recipe, TestData.mobileApiUrl()), recipe);
                System.out.println("Signed in again as " + login + " the way the phone app does - the kept sign-in had no " + key);
                v = VALUES.getOrDefault(k, Map.of()).get(key);
            } catch (RuntimeException e) {
                why = " (the new sign-in: " + e.getMessage() + ")";
            }
        }
        if (v == null || v.isBlank()) throw new IllegalStateException("The phone sign-in of " + login + " did not keep " + key
                + " - add it to the sign-in recipe's browser list" + why);
        return v;
    }

    /** the phone app's own headers on every call (e.g. type: flutter) */
    public static Map<String, String> headers(String login) {
        bearer(login);
        JsonObject s = SHAPES.get(String.valueOf(login).trim().toLowerCase());
        Map<String, String> out = new java.util.LinkedHashMap<>();
        if (s != null && s.has("headers")) s.getAsJsonObject("headers").entrySet().forEach(e -> out.put(e.getKey(), e.getValue().getAsString()));
        return out;
    }

    /** the payload in the phone app's envelope (UserID, page, a fresh request id, Data); a body with "Data" goes as it is */
    public static Object wrap(String login, Object body) {
        JsonObject s = SHAPES.get(String.valueOf(login).trim().toLowerCase());
        if (body == null || s == null || !s.has("envelope")) return body;
        JsonElement data = body instanceof String text ? parse(text) : GSON.toJsonTree(body);
        if (data.isJsonObject() && (data.getAsJsonObject().has("Data") || data.getAsJsonObject().has("data"))) return body;
        JsonObject env = s.getAsJsonObject("envelope").deepCopy();
        for (Map.Entry<String, JsonElement> e : env.entrySet()) {
            String t = e.getValue().isJsonPrimitive() ? e.getValue().getAsString() : "";
            if ("{{data}}".equals(t)) e.setValue(data);
            else if ("{{new:id}}".equals(t)) e.setValue(new com.google.gson.JsonPrimitive(java.util.UUID.randomUUID().toString()));
        }
        return GSON.toJson(env);
    }

    private static JsonElement parse(String text) {
        try {
            return JsonParser.parseString(text);
        } catch (RuntimeException e) {
            return new com.google.gson.JsonPrimitive(text);
        }
    }

    /** the envelope's "{{signIn:KEY}}" values from the sign-in's kept keys */
    private static JsonObject shape(JsonObject callShape, Map<String, Map<String, String>> kept) {
        JsonObject out = callShape.deepCopy();
        if (!out.has("envelope") || !out.get("envelope").isJsonObject()) return out;
        for (Map.Entry<String, JsonElement> e : out.getAsJsonObject("envelope").entrySet()) {
            String t = e.getValue().isJsonPrimitive() ? e.getValue().getAsString() : "";
            if (!t.startsWith("{{signIn:") || !t.endsWith("}}")) continue;
            String key = t.substring(9, t.length() - 2);
            String v = kept.getOrDefault("localStorage", Map.of()).get(key);
            if (v == null) v = kept.getOrDefault("sessionStorage", Map.of()).get(key);
            e.setValue(v == null ? com.google.gson.JsonNull.INSTANCE : new com.google.gson.JsonPrimitive(v));
        }
        return out;
    }

    private static JsonObject phoneRecipe(String login) {
        for (Map.Entry<String, JsonElement> e : load().entrySet()) {
            if (e.getKey().equalsIgnoreCase(String.valueOf(login).trim()) && e.getValue().isJsonObject()
                    && e.getValue().getAsJsonObject().has("calls")) return e.getValue().getAsJsonObject();
        }
        return null;
    }

    private static synchronized JsonObject load() {
        if (recipes != null) return recipes;
        String fromEnv = System.getenv("FIA_CREDENTIALS_FILE");
        Path file = Path.of(System.getProperty("credentialsFile", fromEnv != null && !fromEnv.isBlank() ? fromEnv : "data/credentials.json"));
        try {
            JsonElement root = Files.isRegularFile(file) ? JsonParser.parseString(Files.readString(file, StandardCharsets.UTF_8)) : null;
            JsonElement s = root != null && root.isJsonObject() ? root.getAsJsonObject().get("signInApiPhone") : null;
            recipes = s != null && s.isJsonObject() ? s.getAsJsonObject() : new JsonObject();
        } catch (Exception e) {
            recipes = new JsonObject();
        }
        return recipes;
    }
}
