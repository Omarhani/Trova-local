package utils;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonPrimitive;
import io.restassured.response.Response;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Omar 2026-10-27 (writer sessions 290 / 292: set-up bodies were invented, e.g. {"Date","Hours","Notes"}): the body Trova
 * KNOWS for an app endpoint - the last passed AI walk's app_call of it, else the Endpoints catalog's saved body - handed
 * to the run in data/credentials.json "knownCalls" like the sign-ins. Filled with the signed-in login's own ids (by field
 * name: USER_ID → UserId), placeholders ({today}, {userId}, {<any field>}) and the writer's overrides by field name.
 */
public final class KnownCall {

    /** one known call: side WEB / MOBILE, method, path, the body ("" = none), from "walk" or "catalog", the walk's login */
    public record Known(String side, String method, String path, String body, String from, String as) {
    }

    private static final Gson GSON = new Gson();
    private static List<Known> all;

    private KnownCall() {
    }

    /** the known call of this endpoint on this side (a walk's first, then the catalog's); null when Trova knows none */
    public static Known find(String side, String method, String path) {
        String want = plain(path);
        Known any = null;
        for (Known k : load()) {
            if (!k.side().equalsIgnoreCase(side == null ? "WEB" : side) || !same(plain(k.path()), want)) continue;
            if (method == null || method.isBlank()) {
                if (!"GET".equals(k.method())) return k;
                if (any == null) any = k;
            } else if (k.method().equalsIgnoreCase(method)) return k;
        }
        return any;
    }

    /** "POST /api/x" → {"POST", "/api/x"}; "/api/x" → {"", "/api/x"} */
    public static String[] split(String endpoint) {
        String e = endpoint == null ? "" : endpoint.strip();
        int space = e.indexOf(' ');
        if (space > 0 && e.substring(0, space).matches("(?i)GET|POST|PUT|PATCH|DELETE")) {
            return new String[] {e.substring(0, space).toUpperCase(Locale.ROOT), e.substring(space + 1).strip()};
        }
        return new String[] {"", e};
    }

    /** the path with its {name} parts filled from the overrides */
    public static String path(String path, Map<String, ?> overrides) {
        String out = path;
        if (overrides != null) for (Map.Entry<String, ?> o : overrides.entrySet()) {
            out = out.replace("{" + o.getKey() + "}", String.valueOf(o.getValue()));
        }
        return out;
    }

    /** the known body filled: overrides by field name, then placeholders, then the sign-in's own ids by field name; null = no body */
    public static String body(Known known, Map<String, String> signIn, Map<String, ?> overrides) {
        if (known == null || known.body() == null || known.body().isBlank()) {
            return overrides == null || overrides.isEmpty() ? null : GSON.toJson(overrides);
        }
        JsonElement json;
        try {
            json = JsonParser.parseString(known.body());
        } catch (RuntimeException notJson) {
            return text(known.body(), signIn, overrides);
        }
        JsonElement filled = fill(json, signIn, overrides);
        if (filled.isJsonObject() && overrides != null) { // Omar 2026-10-27: a field the known body lacks is added
            for (Map.Entry<String, ?> o : overrides.entrySet()) {
                if (!has(filled, norm(o.getKey())) && !known.path().contains("{" + o.getKey() + "}")) {
                    filled.getAsJsonObject().add(o.getKey(), GSON.toJsonTree(o.getValue()));
                }
            }
        }
        return GSON.toJson(filled);
    }

    /** the answer when the app took the call; else the test is skipped with the APP'S OWN words (never a bare "needs …") */
    public static Response okOrSkip(Response answer, String what) {
        if (answer != null && answer.statusCode() >= 200 && answer.statusCode() < 300) return answer;
        throw new org.testng.SkipException("Not tested - " + what + " - the app refused it: " + AppReason.of(answer));
    }

    private static JsonElement fill(JsonElement e, Map<String, String> signIn, Map<String, ?> overrides) {
        if (e.isJsonArray()) {
            JsonArray out = new JsonArray();
            e.getAsJsonArray().forEach(x -> out.add(fill(x, signIn, overrides)));
            return out;
        }
        if (e.isJsonPrimitive()) return placeholder(e, signIn, overrides);
        if (!e.isJsonObject()) return e;
        JsonObject out = new JsonObject();
        for (Map.Entry<String, JsonElement> f : e.getAsJsonObject().entrySet()) {
            Object given = byName(overrides, f.getKey());
            String own = byName(signIn, f.getKey()) instanceof String s ? s : null;
            if (given != null) out.add(f.getKey(), GSON.toJsonTree(given));
            else if (f.getValue().isJsonPrimitive() && placeholderName(f.getValue()) == null && own != null) out.add(f.getKey(), typed(own, f.getValue()));
            else out.add(f.getKey(), fill(f.getValue(), signIn, overrides));
        }
        return out;
    }

    /** "{name}" / "{{name}}" → its value; anything else as it is */
    private static JsonElement placeholder(JsonElement v, Map<String, String> signIn, Map<String, ?> overrides) {
        String name = placeholderName(v);
        if (name == null) return v;
        Object given = byName(overrides, name);
        if (given != null) return GSON.toJsonTree(given);
        Object own = byName(signIn, name);
        if (own != null) return new JsonPrimitive(String.valueOf(own));
        String time = time(name);
        if (time != null) return new JsonPrimitive(time);
        throw new IllegalStateException("The known body needs \"" + name + "\" - give it by field name in the call's values");
    }

    private static String placeholderName(JsonElement v) {
        if (!v.isJsonPrimitive() || !v.getAsJsonPrimitive().isString()) return null;
        String t = v.getAsString().strip();
        if (t.matches("\\{\\{[^{}]+}}")) return t.substring(2, t.length() - 2).strip();
        if (t.matches("\\{[A-Za-z_][\\w.:-]*}")) return t.substring(1, t.length() - 1);
        return null;
    }

    /** {today} {tomorrow} {now} {date} */
    private static String time(String name) {
        return switch (norm(name)) {
            case "today", "date" -> LocalDate.now().toString();
            case "tomorrow" -> LocalDate.now().plusDays(1).toString();
            case "now", "datetime" -> LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS).toString();
            default -> null;
        };
    }

    private static String text(String body, Map<String, String> signIn, Map<String, ?> overrides) {
        String out = body;
        if (overrides != null) for (Map.Entry<String, ?> o : overrides.entrySet()) out = out.replace("{" + o.getKey() + "}", String.valueOf(o.getValue()));
        if (signIn != null) for (Map.Entry<String, String> s : signIn.entrySet()) out = out.replace("{" + s.getKey() + "}", String.valueOf(s.getValue()));
        return out;
    }

    /** a value by field name, case and "_" / "-" ignored (USER_ID = userId = UserID) */
    private static Object byName(Map<String, ?> values, String field) {
        if (values == null) return null;
        String want = norm(field);
        for (Map.Entry<String, ?> e : values.entrySet()) if (norm(e.getKey()).equals(want) && e.getValue() != null) return e.getValue();
        return null;
    }

    private static boolean has(JsonElement e, String want) {
        if (e.isJsonArray()) for (JsonElement x : e.getAsJsonArray()) if (has(x, want)) return true;
        if (!e.isJsonObject()) return false;
        for (Map.Entry<String, JsonElement> f : e.getAsJsonObject().entrySet()) if (norm(f.getKey()).equals(want) || has(f.getValue(), want)) return true;
        return false;
    }

    /** the sign-in's text value in the known value's type (a number stays a number) */
    private static JsonElement typed(String value, JsonElement was) {
        if (was.getAsJsonPrimitive().isNumber() && value.matches("-?\\d+")) return new JsonPrimitive(Long.parseLong(value));
        return new JsonPrimitive(value);
    }

    private static String norm(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    /** a path without scheme / host / query, lower case, no trailing slash */
    static String plain(String path) {
        String p = path == null ? "" : path.strip().toLowerCase(Locale.ROOT);
        int q = p.indexOf('?');
        if (q >= 0) p = p.substring(0, q);
        int scheme = p.indexOf("://");
        if (scheme >= 0) {
            int slash = p.indexOf('/', scheme + 3);
            p = slash < 0 ? "/" : p.substring(slash);
        }
        if (!p.startsWith("/")) p = "/" + p;
        return p.length() > 1 && p.endsWith("/") ? p.substring(0, p.length() - 1) : p;
    }

    /** same path; a {name} part matches any part */
    static boolean same(String a, String b) {
        if (a.equals(b)) return true;
        String[] x = a.split("/"), y = b.split("/");
        if (x.length != y.length) return false;
        for (int i = 0; i < x.length; i++) {
            if (!x[i].equals(y[i]) && !x[i].startsWith("{") && !y[i].startsWith("{")) return false;
        }
        return true;
    }

    private static synchronized List<Known> load() {
        if (all != null) return all;
        List<Known> out = new ArrayList<>();
        String fromEnv = System.getenv("FIA_CREDENTIALS_FILE");
        Path file = Path.of(System.getProperty("credentialsFile", fromEnv != null && !fromEnv.isBlank() ? fromEnv : "data/credentials.json"));
        try {
            JsonElement root = Files.isRegularFile(file) ? JsonParser.parseString(Files.readString(file, StandardCharsets.UTF_8)) : null;
            JsonElement list = root != null && root.isJsonObject() ? root.getAsJsonObject().get("knownCalls") : null;
            if (list != null && list.isJsonArray()) for (JsonElement e : list.getAsJsonArray()) {
                if (!e.isJsonObject()) continue;
                JsonObject o = e.getAsJsonObject();
                out.add(new Known(s(o, "side", "WEB").toUpperCase(Locale.ROOT), s(o, "method", "GET").toUpperCase(Locale.ROOT),
                        s(o, "path", "/"), s(o, "body", ""), s(o, "from", ""), s(o, "as", "")));
            }
        } catch (Exception unreadable) {
            System.out.println("Trova's known calls could not be read: " + unreadable.getMessage());
        }
        all = out;
        return all;
    }

    private static String s(JsonObject o, String key, String or) {
        JsonElement v = o.get(key);
        if (v == null || v.isJsonNull()) return or;
        return v.isJsonPrimitive() ? v.getAsString() : v.toString();
    }
}
