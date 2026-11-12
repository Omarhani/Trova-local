package utils;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Trova TICKET-980 (Omar 2026-10-23) - when a sign-in runs out, read from its own values: a token's "exp" (only the
 * token's middle part is decoded, never printed), a cookie's end time, a key / field named like expires, expiry, exp,
 * expires_in. Sign-ins can live 3 h or 5 min (banking): a suite or a next-day regression must never fail because one ran
 * out, so Trova refreshes it when it runs out within min(2 min, 20% of its life). The keys that came with the sign-in
 * count (every key when none is tagged); the shortest end wins. Nothing here knows the app.
 */
public final class SignInClock {

    private static final Pattern JWT = Pattern.compile("eyJ[A-Za-z0-9_-]{4,}\\.(eyJ[A-Za-z0-9_-]{4,})\\.[A-Za-z0-9_-]*");
    private static final Pattern END_NAME = Pattern.compile("(?i:expir|valid_?until|(^|[^a-z])exp($|[^a-z]))|[a-z]Exp($|[A-Z_])");
    private static final Pattern RELATIVE = Pattern.compile("(?i).*expires_?in$|.*max_?age$");
    private static final Pattern ANALYTICS = Pattern.compile("(?i)^(__mpq|mp_|_ga|_gid|_gcl|_grecaptcha|amplitude|ajs_|_hj|intercom|lr-|_lr|_fbp|__stripe|optimizely|_dd)");
    private static final long TWO_MIN = 120_000;

    /** at = epoch ms it runs out (0 = no end time found); life = ms it lives in all */
    public record End(long at, long life) {
        /** true when it runs out within min(2 min, 20% of its life) from now (or already did) */
        public boolean soon() {
            return at > 0 && System.currentTimeMillis() >= at - Math.min(TWO_MIN, Math.max(0, life) / 5);
        }

        /** true when it has run out already */
        public boolean expired() {
            return at > 0 && System.currentTimeMillis() >= at;
        }

        /** "in 4 min" / "2 min ago" - for the run's log */
        public String words() {
            long min = (at - System.currentTimeMillis()) / 60_000;
            return min >= 0 ? "in " + min + " min" : -min + " min ago";
        }
    }

    private SignInClock() {
    }

    /** the shortest end time of a kept browser state ({localStorage, sessionStorage, cookies, signIn}) */
    public static End of(JsonObject state) {
        Best best = new Best();
        if (state == null) return best.end();
        Set<String> tagged = new HashSet<>();
        if (state.has("signIn") && state.get("signIn").isJsonArray()) {
            state.getAsJsonArray("signIn").forEach(t -> tagged.add(t.getAsJsonObject().get("place").getAsString() + "\n" + t.getAsJsonObject().get("key").getAsString()));
        }
        for (String place : new String[] {"localStorage", "sessionStorage"}) {
            if (!state.has(place) || !state.get(place).isJsonObject()) continue;
            for (Map.Entry<String, JsonElement> e : state.getAsJsonObject(place).entrySet()) {
                if (counts(tagged, place, e.getKey()) && e.getValue().isJsonPrimitive()) value(best, e.getKey(), e.getValue().getAsString());
            }
        }
        if (state.has("cookies") && state.get("cookies").isJsonArray()) {
            for (JsonElement c : state.getAsJsonArray("cookies")) {
                JsonObject o = c.getAsJsonObject();
                String name = o.has("name") ? o.get("name").getAsString() : "";
                if (!counts(tagged, "cookies", name)) continue;
                if (o.has("value") && o.get("value").isJsonPrimitive()) value(best, name, o.get("value").getAsString());
                if (o.has("expires") && o.get("expires").isJsonPrimitive()) best.offer((long) (o.get("expires").getAsDouble() * 1000), 0);
            }
        }
        return best.end();
    }

    /** the end of one token (an API test's Bearer token); at = 0 when it is not a token with "exp" */
    public static End ofToken(String token) {
        Best best = new Best();
        if (token != null) value(best, "", token);
        return best.end();
    }

    private static boolean counts(Set<String> tagged, String place, String key) {
        if (ANALYTICS.matcher(key).find()) return false;
        return tagged.isEmpty() || tagged.contains(place + "\n" + key);
    }

    private static void value(Best best, String key, String value) {
        Matcher m = JWT.matcher(value);
        while (m.find()) jwt(best, m.group(1));
        String v = value.strip();
        if (v.startsWith("{") || v.startsWith("[")) {
            try {
                walk(best, JsonParser.parseString(v), 0);
            } catch (Exception ignored) {
                // not JSON after all
            }
        } else if (END_NAME.matcher(key).find()) {
            end(best, key, v);
        }
    }

    private static void walk(Best best, JsonElement node, int depth) {
        if (depth > 6) return;
        if (node.isJsonObject()) {
            for (Map.Entry<String, JsonElement> f : node.getAsJsonObject().entrySet()) {
                if (f.getValue().isJsonPrimitive() && END_NAME.matcher(f.getKey()).find()) end(best, f.getKey(), f.getValue().getAsString());
                else walk(best, f.getValue(), depth + 1);
            }
        } else if (node.isJsonArray()) {
            node.getAsJsonArray().forEach(n -> walk(best, n, depth + 1));
        }
    }

    private static void jwt(Best best, String payload) {
        try {
            JsonObject claims = JsonParser.parseString(new String(Base64.getUrlDecoder().decode(payload), StandardCharsets.UTF_8)).getAsJsonObject();
            if (!claims.has("exp") || !claims.get("exp").isJsonPrimitive() || !claims.get("exp").getAsJsonPrimitive().isNumber()) return;
            long iat = claims.has("iat") && claims.get("iat").isJsonPrimitive() && claims.get("iat").getAsJsonPrimitive().isNumber() ? claims.get("iat").getAsLong() * 1000 : 0;
            best.offer(claims.get("exp").getAsLong() * 1000, iat);
        } catch (Exception ignored) {
            // not a token after all
        }
    }

    private static void end(Best best, String name, String text) {
        if (text.isEmpty()) return;
        try {
            double n = Double.parseDouble(text);
            if (RELATIVE.matcher(name).matches()) return; // seconds from an unknown moment: the save time is not known here
            if (n > 1e9) best.offer((long) (n > 1e11 ? n : n * 1000), 0);
            return;
        } catch (NumberFormatException notNumber) {
            // a date then
        }
        try {
            best.offer(OffsetDateTime.parse(text).toInstant().toEpochMilli(), 0);
        } catch (Exception notDate) {
            try {
                best.offer(Instant.parse(text).toEpochMilli(), 0);
            } catch (Exception ignored) {
                // neither: not an end time
            }
        }
    }

    private static final class Best {
        long at;
        long from;
        /** ends older than 30 days are leftovers of an earlier sign-in (a stale value the app no longer reads) */
        final long oldest = System.currentTimeMillis() - 30L * 86_400_000L;
        final long latest = System.currentTimeMillis() + 400L * 86_400_000L;

        void offer(long end, long start) {
            if (end <= oldest || end > latest || (at > 0 && end >= at)) return;
            at = end;
            from = start > 0 && start < end ? start : 0;
        }

        End end() {
            // life unknown (no "iat"): count it as long - the 2 min margin applies
            return new End(at, from > 0 ? at - from : Long.MAX_VALUE / 4);
        }
    }
}
