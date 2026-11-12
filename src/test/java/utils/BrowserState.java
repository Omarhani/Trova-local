package utils;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.openqa.selenium.Cookie;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Trova (Omar 2026-10-23) - the browser's whole state for one app (every cookie, every local- and session-storage key):
 * read it after a real sign-in, put it back BEFORE the app's own code starts, and check the page then matches a real
 * sign-in. Chrome / Edge: cookies through DevTools (Network.setCookies, with their domain) and storage through a script
 * that runs at the start of the next page load; other browsers: a page of the app's origin first, then the values,
 * then the app. Values are never printed - only key names.
 */
final class BrowserState {

    private static final Gson GSON = new Gson();
    /** keys of analytics / captcha scripts: they come with a sign-in page but say nothing about being signed in */
    private static final Pattern THIRD_PARTY = Pattern.compile("(?i)^(__mpq|mp_|_ga|_gid|_gcl|_grecaptcha|amplitude|ajs_|_hj|intercom|lr-|_lr|_fbp|__stripe|optimizely|_dd)");
    private static final Pattern LOGIN_PATH = Pattern.compile("(?i)(^|[/#])(log-?in|sign-?in|signin|auth|sso)([/?#]|$)");

    private BrowserState() {
    }

    /** the state of the page's origin now: {origin, at, localStorage, sessionStorage, cookies: [...]} */
    @SuppressWarnings("unchecked")
    static JsonObject read(WebDriver driver) {
        JavascriptExecutor js = (JavascriptExecutor) driver;
        Object page = js.executeScript("var o = function (s) { var r = {}; try { for (var i = 0; i < s.length; i++) { var k = s.key(i); r[k] = s.getItem(k); } } catch (e) {} return r; };"
                + "return { origin: location.origin, at: location.href, local: o(window.localStorage), session: o(window.sessionStorage) };");
        Map<String, Object> p = page instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
        JsonObject state = new JsonObject();
        state.addProperty("origin", String.valueOf(p.getOrDefault("origin", "")));
        state.addProperty("at", String.valueOf(p.getOrDefault("at", "")));
        state.add("localStorage", GSON.toJsonTree(p.getOrDefault("local", Map.of())));
        state.add("sessionStorage", GSON.toJsonTree(p.getOrDefault("session", Map.of())));
        JsonArray cookies = new JsonArray();
        for (Map<String, Object> c : cdpCookies(driver)) cookies.add(GSON.toJsonTree(c));
        if (cookies.isEmpty()) {
            for (Cookie c : driver.manage().getCookies()) {
                JsonObject o = new JsonObject();
                o.addProperty("name", c.getName());
                o.addProperty("value", c.getValue());
                if (c.getDomain() != null) o.addProperty("domain", c.getDomain());
                o.addProperty("path", c.getPath() == null ? "/" : c.getPath());
                o.addProperty("secure", c.isSecure());
                o.addProperty("httpOnly", c.isHttpOnly());
                if (c.getExpiry() != null) o.addProperty("expires", c.getExpiry().getTime() / 1000.0);
                cookies.add(o);
            }
        }
        state.add("cookies", cookies);
        return state;
    }

    /** tags the keys that appeared or changed against {@code before} (the state just before the sign-in) */
    static void tagSignIn(JsonObject before, JsonObject after) {
        JsonArray tags = new JsonArray();
        boolean same = before != null && before.get("origin").getAsString().equals(after.get("origin").getAsString());
        for (String place : new String[] {"localStorage", "sessionStorage"}) {
            JsonObject was = same ? before.getAsJsonObject(place) : new JsonObject();
            for (Map.Entry<String, JsonElement> e : after.getAsJsonObject(place).entrySet()) {
                if (!e.getValue().equals(was.get(e.getKey()))) tags.add(tag(place, e.getKey()));
            }
        }
        Map<String, String> oldCookies = new HashMap<>();
        if (before != null) before.getAsJsonArray("cookies").forEach(c -> oldCookies.put(name(c), value(c)));
        after.getAsJsonArray("cookies").forEach(c -> {
            if (!value(c).equals(oldCookies.get(name(c)))) tags.add(tag("cookies", name(c)));
        });
        after.add("signIn", tags);
    }

    /** opens {@code url} with the whole kept state in the browser before the app starts */
    static void restore(WebDriver driver, String url, JsonObject state) {
        URI target = URI.create(url);
        String origin = target.getScheme() + "://" + target.getAuthority();
        String kept = state.has("origin") ? state.get("origin").getAsString() : origin;
        StringBuilder script = new StringBuilder("if (location.origin === ").append(GSON.toJson(kept)).append(") { try {");
        for (String place : new String[] {"localStorage", "sessionStorage"}) {
            JsonObject values = state.has(place) && state.get(place).isJsonObject() ? state.getAsJsonObject(place) : new JsonObject();
            values.entrySet().forEach(e -> script.append(place).append(".setItem(").append(GSON.toJson(e.getKey())).append(',')
                    .append(GSON.toJson(e.getValue().isJsonPrimitive() ? e.getValue().getAsString() : e.getValue().toString())).append(");"));
        }
        script.append("} catch (e) {} }");
        JsonArray cookies = state.has("cookies") && state.get("cookies").isJsonArray() ? state.getAsJsonArray("cookies") : new JsonArray();
        if (driver instanceof org.openqa.selenium.chromium.ChromiumDriver chromium) {
            chromium.executeCdpCommand("Network.clearBrowserCookies", Map.of());
            if (!cookies.isEmpty()) {
                List<Map<String, Object>> list = new ArrayList<>();
                for (JsonElement c : cookies) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> one = new LinkedHashMap<>(GSON.fromJson(c, Map.class));
                    if (!one.containsKey("domain")) one.put("url", kept);
                    list.add(one);
                }
                chromium.executeCdpCommand("Network.setCookies", Map.of("cookies", list));
            }
            Object id = chromium.executeCdpCommand("Page.addScriptToEvaluateOnNewDocument", Map.of("source", script.toString())).get("identifier");
            try {
                PageOpen.get(driver, url); // Omar 2026-11-06: a slow part of the page never holds the test 30 s
            } finally {
                chromium.executeCdpCommand("Page.removeScriptToEvaluateOnNewDocument", Map.of("identifier", id));
            }
            return;
        }
        driver.get(kept + "/favicon.ico"); // Omar 2026-10-27: other browsers - a blank page of the origin (not the app), the values, then the app once
        driver.manage().deleteAllCookies();
        for (JsonElement c : cookies) {
            JsonObject o = c.getAsJsonObject();
            driver.manage().addCookie(new Cookie.Builder(name(o), value(o)).path(o.has("path") ? o.get("path").getAsString() : "/")
                    .isSecure(o.has("secure") && o.get("secure").getAsBoolean()).isHttpOnly(o.has("httpOnly") && o.get("httpOnly").getAsBoolean()).build());
        }
        ((JavascriptExecutor) driver).executeScript(script.toString());
        PageOpen.get(driver, url);
    }

    /**
     * Does the page match a real sign-in? On the app's host, past the sign-in (no password / code box, off a sign-in
     * address), the login's done sign or the signed-in shell ({@link SignInPage#signedIn} - the AI agent's own check), and
     * the keys that came with the sign-in still there - checked again and again for up to 10 s. Returns null when it
     * does, else what is wrong in plain words (key names only). Keys that did not come with the sign-in (analytics, a
     * theme) may change or go: they never fail it.
     */
    static String check(WebDriver driver, JsonObject state, String done) {
        return check(driver, state, done, null);
    }

    static String check(WebDriver driver, JsonObject state, String done, String start) {
        JavascriptExecutor js = (JavascriptExecutor) driver;
        for (int t = 0; t < 15000 && !"complete".equals(js.executeScript("return document.readyState")); t += 300) sleep(300);
        String at = state.has("at") ? state.get("at").getAsString() : "";
        String host = URI.create(at.isBlank() ? state.get("origin").getAsString() : at).getHost();
        List<String> local = new ArrayList<>();
        List<String> session = new ArrayList<>();
        if (state.has("signIn") && state.get("signIn").isJsonArray()) {
            for (JsonElement tag : state.getAsJsonArray("signIn")) {
                JsonObject o = tag.getAsJsonObject();
                String place = o.has("place") ? o.get("place").getAsString() : "";
                if (THIRD_PARTY.matcher(o.get("key").getAsString()).find()) continue; // analytics / captcha: the app makes them again
                if ("localStorage".equals(place)) local.add(o.get("key").getAsString());
                if ("sessionStorage".equals(place)) session.add(o.get("key").getAsString());
            }
        }
        String wrong = "the page could not be read";
        long until = System.currentTimeMillis() + 10000;
        do {
            @SuppressWarnings("unchecked")
            Map<String, Object> p = (Map<String, Object>) js.executeScript(
                    "var miss = []; try { arguments[0].forEach(function (k) { if (localStorage.getItem(k) === null) miss.push(k); });"
                            + " arguments[1].forEach(function (k) { if (sessionStorage.getItem(k) === null) miss.push(k); }); } catch (e) {}"
                            + "return { host: location.host, miss: miss };", local, session);
            List<?> miss = (List<?>) p.get("miss");
            if (host != null && !String.valueOf(p.get("host")).startsWith(host)) return "the app went to another site (" + p.get("host") + ")";
            String page = SignInPage.signedIn(driver, done, start);
            if ("the app showed its sign-in page".equals(page) && LOGIN_PATH.matcher(String.valueOf(js.executeScript("return location.pathname + location.hash"))).find()) {
                return page; // sent back to the sign-in address: it will not change by waiting
            }
            wrong = page != null ? page : miss.isEmpty() ? null
                    : "the app dropped " + miss.size() + " kept value(s): " + String.join(", ", miss.stream().map(String::valueOf).toList());
            if (wrong == null) return null;
            sleep(400);
        } while (System.currentTimeMillis() < until);
        return wrong;
    }

    /** empties the app's storage and every cookie (a kept sign-in that did not work) */
    static void clear(WebDriver driver) {
        try {
            ((JavascriptExecutor) driver).executeScript("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
            driver.manage().deleteAllCookies();
        } catch (Exception ignored) {
            // a page without storage: nothing to clear
        }
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> cdpCookies(WebDriver driver) {
        if (!(driver instanceof org.openqa.selenium.chromium.ChromiumDriver chromium)) return List.of();
        try {
            Object all = chromium.executeCdpCommand("Network.getAllCookies", Map.of()).get("cookies");
            List<Map<String, Object>> out = new ArrayList<>();
            for (Object c : (List<Object>) all) {
                Map<String, Object> m = (Map<String, Object>) c;
                Map<String, Object> o = new LinkedHashMap<>();
                for (String f : new String[] {"name", "value", "domain", "path", "secure", "httpOnly", "sameSite"}) if (m.get(f) != null) o.put(f, m.get(f));
                if (!Boolean.TRUE.equals(m.get("session")) && m.get("expires") instanceof Number n && n.doubleValue() > 0) o.put("expires", n.doubleValue());
                out.add(o);
            }
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }

    private static JsonObject tag(String place, String key) {
        JsonObject o = new JsonObject();
        o.addProperty("place", place);
        o.addProperty("key", key);
        return o;
    }

    private static String name(JsonElement c) {
        return c.getAsJsonObject().get("name").getAsString();
    }

    private static String value(JsonElement c) {
        JsonElement v = c.getAsJsonObject().get("value");
        return v == null || v.isJsonNull() ? "" : v.getAsString();
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
