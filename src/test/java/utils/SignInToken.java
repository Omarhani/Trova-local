package utils;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Omar 2026-10-25: "Clean up programmatically" (and a test's own API set-up) uses the run's ONE sign-in, never a new
 * one: the app's token from the state that sign-in made (a storage key, a field inside a stored JSON value, a cookie).
 * Throws "Sign-in did not work: ..." at once when the run's sign-in was refused or left no token. Never printed.
 */
public final class SignInToken {

    private static final Pattern JWT = Pattern.compile("eyJ[A-Za-z0-9_-]{4,}\\.eyJ[A-Za-z0-9_-]{4,}\\.[A-Za-z0-9_-]*");

    private SignInToken() {
    }

    /** the token of the run's sign-in as {@code login} - send it as "Authorization: Bearer <token>" */
    public static String bearer(String login) {
        String refused = SignedInRun.refused(login);
        if (refused != null) throw new IllegalStateException(refused);
        String token = ApiSignIn.token(login); // Omar 2026-10-25: the run's one API sign-in first
        if (token == null && ApiSignIn.has(login)) token = ApiSignIn.signIn(login).token(); // an API-only run: its one sign-in
        if (token == null) token = find(KeptSignIn.state(login));
        if (token == null) {
            throw new IllegalStateException(SignedInRun.PREFIX + "the run has no saved sign-in with a token for \"" + login
                    + "\" - the clean-up cannot call the app's API with it");
        }
        return token;
    }

    /** the first token-shaped value in a kept state, or null */
    static String find(JsonObject state) {
        if (state == null) return null;
        for (String place : new String[] {"localStorage", "sessionStorage"}) {
            if (!state.has(place) || !state.get(place).isJsonObject()) continue;
            for (Map.Entry<String, JsonElement> e : state.getAsJsonObject(place).entrySet()) {
                String t = e.getValue().isJsonPrimitive() ? token(e.getValue().getAsString()) : null;
                if (t != null) return t;
            }
        }
        if (state.has("cookies") && state.get("cookies").isJsonArray()) {
            for (JsonElement c : state.getAsJsonArray("cookies")) {
                JsonElement v = c.isJsonObject() ? c.getAsJsonObject().get("value") : null;
                String t = v != null && v.isJsonPrimitive() ? token(v.getAsString()) : null;
                if (t != null) return t;
            }
        }
        return null;
    }

    /** a token in a value (the value itself, or inside its JSON / quotes) */
    private static String token(String value) {
        if (value == null) return null;
        Matcher m = JWT.matcher(value);
        return m.find() ? m.group() : null;
    }
}
