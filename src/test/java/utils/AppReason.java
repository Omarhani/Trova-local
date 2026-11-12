package utils;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import io.restassured.response.Response;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Omar 2026-10-27 (local Test try #257: every overtime set-up skipped "the app refused it: HTTP 400 null"): the app's
 * words for a refused call - its "Message", else the first validation error or the title (ASP.NET "errors" / "title"),
 * never "null". The last refused call's words per thread fill a skip reason that only says "HTTP 400 null".
 */
public final class AppReason {

    private static final Pattern NULL_REASON = Pattern.compile("HTTP (\\d{3}) null");
    private static final ThreadLocal<String> LAST = new ThreadLocal<>();

    private AppReason() {
    }

    /** "HTTP 400 <the app's words>" for a refused answer, or just "HTTP 400" when the body says nothing */
    public static String of(Response answer) {
        if (answer == null) return "no answer";
        String said = of(answer.asString());
        return "HTTP " + answer.statusCode() + (said == null ? "" : " " + said);
    }

    /** the body's own words: Message, else the first validation error, else title / detail; null when none */
    public static String of(String body) {
        try {
            JsonElement json = body == null || body.isBlank() ? null : JsonParser.parseString(body);
            if (json == null || !json.isJsonObject()) return null;
            JsonObject o = json.getAsJsonObject();
            String message = text(o, "Message");
            if (message == null) message = text(o, "message");
            if (message != null) return message;
            String error = firstError(o.get("errors"));
            if (error != null) return error;
            String title = text(o, "title");
            return title != null ? title : text(o, "detail");
        } catch (Exception e) {
            return null;
        }
    }

    /** the API report notes each refused call's words for this thread */
    static void noted(int status, String body) {
        if (status < 400) return;
        String said = of(body);
        if (said != null) LAST.set(said);
    }

    /** a new test: no words from an earlier test's call */
    static void clear() {
        LAST.remove();
    }

    /** a reason that says "HTTP 400 null" gets the last refused call's words instead of "null" */
    public static String fill(String reason) {
        String last = LAST.get();
        if (reason == null) return null;
        Matcher m = NULL_REASON.matcher(reason);
        if (!m.find()) return reason;
        return m.replaceAll(Matcher.quoteReplacement("HTTP ") + "$1" + Matcher.quoteReplacement(last == null ? " (the app gave no reason)" : " " + last));
    }

    private static String firstError(JsonElement errors) {
        if (errors == null || errors.isJsonNull()) return null;
        if (errors.isJsonObject()) {
            for (Map.Entry<String, JsonElement> e : errors.getAsJsonObject().entrySet()) {
                String first = firstText(e.getValue());
                if (first != null) return e.getKey().isBlank() ? first : e.getKey().replaceFirst("^\\$\\.", "") + ": " + first;
            }
        }
        return firstText(errors);
    }

    private static String firstText(JsonElement v) {
        if (v == null || v.isJsonNull()) return null;
        if (v.isJsonPrimitive()) return v.getAsString().isBlank() ? null : v.getAsString();
        if (v.isJsonArray()) {
            for (JsonElement x : v.getAsJsonArray()) {
                String t = firstText(x);
                if (t != null) return t;
            }
        }
        if (v.isJsonObject()) {
            String t = text(v.getAsJsonObject(), "message");
            return t != null ? t : text(v.getAsJsonObject(), "errorMessage");
        }
        return null;
    }

    private static String text(JsonObject o, String key) {
        JsonElement v = o.get(key);
        return v != null && v.isJsonPrimitive() && !v.getAsString().isBlank() ? v.getAsString() : null;
    }
}
