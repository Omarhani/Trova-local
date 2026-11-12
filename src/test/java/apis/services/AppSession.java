package apis.services;

import com.google.gson.Gson;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * What the portal keeps in the browser after a sign-in, built from the API sign-in - so a web test opens the portal
 * already signed in (utils.SignedInBrowser): local storage TOKEN, USER, ACCOUNT, CODE (each a JSON value), plus the
 * Arabic language and the light theme the tests run on.
 */
public final class AppSession {

    private static final Gson GSON = new Gson();

    private AppSession() {
    }

    public static Map<String, Map<String, String>> session(String login) {
        AvailoApi.Login signedIn = AvailoApi.login(login);
        Map<String, String> local = new LinkedHashMap<>();
        local.put("TOKEN", GSON.toJson(signedIn.token()));
        local.put("USER", GSON.toJson(signedIn.user()));
        local.put("ACCOUNT", GSON.toJson(signedIn.account()));
        local.put("CODE", GSON.toJson(signedIn.code()));
        local.put("LANGUAGE", GSON.toJson("ar"));
        local.put("THEME", GSON.toJson("light"));
        return Map.of("localStorage", local, "sessionStorage", Map.of(), "cookies", Map.of());
    }
}
