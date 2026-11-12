package utils;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;

import java.util.Map;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Omar 2026-10-25: the pieces of a sign-in recipe (Test Data → Programmatically) - nothing here knows the app. A recipe
 * holds names only, never a value:
 * <pre>
 *   {"calls": [{"method": "POST", "path": "...", "body": {...}, "headers": {...}, "keep": {"name": "answer.path"},
 *               "refusedWhen": {"field": "Status", "is": false, "say": "Message"}, "doneWhen": "name"}],
 *    "transforms": {"name": {"kind": "char-offsets", "offsets": [..], "rest": n}},
 *    "browser": [{"place": "localStorage|sessionStorage|cookies", "key": "...", "from": "name" | "value": "{{...}}", "as": "json|text"},
 *                {"place": "localStorage", "key": "THEME", "value": "\"light\"", "ifMissing": true}],
 *    "token": "name", "codeField": "OTP", "apiRoot": "api"}
 * </pre>
 * Placeholders in a body / header / value: {@code {{login:Field|Other name>transform}}} (a field of the login) and
 * {@code {{keep:name.path}}} (a value an earlier call answered). A whole-string placeholder keeps the JSON shape.
 */
final class ApiSignInRecipe {

    private static final Pattern PLACE = Pattern.compile("\\{\\{(login|keep|new):([^}>]+)(?:>([^}]+))?}}");

    private ApiSignInRecipe() {
    }

    /** a copy of {@code template} with every placeholder filled; {@code field} reads a login field (throws when it is missing) */
    static JsonElement fill(JsonElement template, Function<String, String> field, JsonObject kept, JsonObject transforms) {
        if (template == null || template.isJsonNull()) return JsonNull.INSTANCE;
        if (template.isJsonObject()) {
            JsonObject out = new JsonObject();
            template.getAsJsonObject().entrySet().forEach(e -> out.add(e.getKey(), fill(e.getValue(), field, kept, transforms)));
            return out;
        }
        if (template.isJsonArray()) {
            JsonArray out = new JsonArray();
            template.getAsJsonArray().forEach(e -> out.add(fill(e, field, kept, transforms)));
            return out;
        }
        if (!template.getAsJsonPrimitive().isString()) return template;
        String text = template.getAsString();
        Matcher whole = PLACE.matcher(text);
        if (whole.matches()) return value(whole, field, kept, transforms);
        Matcher m = PLACE.matcher(text);
        StringBuilder out = new StringBuilder();
        while (m.find()) m.appendReplacement(out, Matcher.quoteReplacement(plain(value(m, field, kept, transforms))));
        m.appendTail(out);
        return new JsonPrimitive(out.toString());
    }

    /** a value as text: a string as it is, anything else as its JSON */
    static String plain(JsonElement v) {
        if (v == null || v.isJsonNull()) return "";
        return v.isJsonPrimitive() ? v.getAsString() : v.toString();
    }

    /** the part of {@code root} at a dotted path ("Data.ID"; "" = all of it), or null */
    static JsonElement at(JsonElement root, String path) {
        JsonElement node = root;
        if (path == null || path.isBlank() || ".".equals(path)) return node;
        for (String part : path.split("\\.")) {
            if (node == null || !node.isJsonObject()) return null;
            node = node.getAsJsonObject().get(part);
        }
        return node;
    }

    /** true when the kept value is there and not empty */
    static boolean present(JsonElement v) {
        return v != null && !v.isJsonNull() && !(v.isJsonPrimitive() && v.getAsString().isBlank());
    }

    /** the login field under any of its names ("Account code|Account|code"), any case; null when it has none */
    static String field(Map<String, String> fields, String names) {
        for (String n : names.split("\\|")) {
            for (Map.Entry<String, String> f : fields.entrySet()) {
                if (f.getKey().trim().equalsIgnoreCase(n.trim())) return f.getValue();
            }
        }
        return null;
    }

    /** "char-offsets": each character shifted by its offset (the last ones by "rest") - how some apps send a password */
    static String transform(String value, JsonObject t) {
        if (t == null || !"char-offsets".equals(t.has("kind") ? t.get("kind").getAsString() : "")) return value;
        JsonArray offsets = t.has("offsets") ? t.getAsJsonArray("offsets") : new JsonArray();
        int rest = t.has("rest") ? t.get("rest").getAsInt() : 0;
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < value.length(); i++) {
            out.append((char) (value.charAt(i) + (i < offsets.size() ? offsets.get(i).getAsInt() : rest)));
        }
        return out.toString();
    }

    private static JsonElement value(Matcher m, Function<String, String> field, JsonObject kept, JsonObject transforms) {
        if ("new".equals(m.group(1))) return new com.google.gson.JsonPrimitive(java.util.UUID.randomUUID().toString()); // Omar 2026-10-27: a fresh request id
        if ("login".equals(m.group(1))) {
            String v = field.apply(m.group(2));
            String name = m.group(3);
            JsonObject t = name != null && transforms != null && transforms.has(name) ? transforms.getAsJsonObject(name) : null;
            return new JsonPrimitive(t == null ? v : transform(v, t));
        }
        String path = m.group(2).trim();
        int dot = path.indexOf('.');
        JsonElement root = kept.get(dot < 0 ? path : path.substring(0, dot));
        JsonElement v = dot < 0 ? root : at(root, path.substring(dot + 1));
        return v == null || v.isJsonNull() ? new JsonPrimitive("") : v;
    }
}
