package utils;

import org.openqa.selenium.JavascriptExecutor;

import static utils.MethodHandlesWeb.test;

/** The saved web login of a run: save it, ask for it, drop it, write it back (split out of {@link UtilsTests}, reached through it). */
public class WebSessionSteps extends SignInSteps {

    /**
     * The saved web login ({@link #saveSession()}): every localStorage key and every cookie of the app's origin,
     * per session name. {@link #loginProgrammatically(String)} writes it back before the app starts, so a test
     * opens logged in without the login page. Kept for the run; a new run logs in on the UI once again.
     */
    private record WebSession(String origin, java.util.Map<String, String> localStorage,
                              java.util.Set<org.openqa.selenium.Cookie> cookies) {}

    private static final java.util.Map<String, WebSession> SESSIONS = new java.util.HashMap<>();

    /** The name used when a test saves / replays one login only. */
    public static final String DEFAULT_SESSION = "default";

    /** Saves the browser's login under {@link #DEFAULT_SESSION} - call right after a UI login. */
    public void saveSession() {
        saveSession(DEFAULT_SESSION);
    }

    /** Saves the browser's login (localStorage + cookies of the current origin) under {@code name}. */
    @SuppressWarnings("unchecked")
    public void saveSession(String name) {
        java.net.URI current = java.net.URI.create(driver.getCurrentUrl());
        String origin = current.getScheme() + "://" + current.getAuthority();
        Object storage = ((JavascriptExecutor) driver).executeScript(
                "var o = {}; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i);"
                        + " o[k] = localStorage.getItem(k); } return o;");
        java.util.Map<String, String> values = new java.util.LinkedHashMap<>();
        if (storage instanceof java.util.Map) {
            ((java.util.Map<String, Object>) storage).forEach((k, v) -> values.put(k, v == null ? null : v.toString()));
        }
        SESSIONS.put(name, new WebSession(origin, values, new java.util.HashSet<>(driver.manage().getCookies())));
        System.out.println("Saved the web login \"" + name + "\" (" + values.size() + " localStorage keys, "
                + driver.manage().getCookies().size() + " cookies)");
    }

    /** True when {@link #saveSession(String)} kept a login under {@code name} in this run. */
    public static boolean hasSession(String name) {
        return SESSIONS.containsKey(name);
    }

    /** Drops a saved login - e.g. after a test changed that user's password. */
    public static void forgetSession(String name) {
        SESSIONS.remove(name);
    }

    /** Replays the login saved under {@link #DEFAULT_SESSION} and opens {@code path} (e.g. "/inventory.html"). */
    public void loginProgrammatically(String path) {
        loginProgrammatically(DEFAULT_SESSION, path);
    }

    /**
     * Writes a saved login ({@link #saveSession(String)}) back before any app code runs, then opens {@code path}
     * on the app's origin - the test starts logged in, without the login page.
     *
     * <p>Writing localStorage on the live app and refreshing races the app's own start-up: an app loaded
     * without a login may still be waiting on its first call, and when that answers after the keys were
     * written it logs out - deleting them - so the refresh lands on the login page.
     *
     * <p>Cookies go in first (the browser must be on the origin for that; BaseTests opened WEB_URL already).
     * Chrome / Edge: the localStorage keys go in through a DevTools script that runs at the very start of the
     * next page load, before the app's own code, and is removed right after - no extra page is shown.
     * Any other browser: {@code /robots.txt} of the same origin (same localStorage, no app code) takes the
     * keys first - it flashes on screen for a moment, but nothing can wipe them.
     */
    public void loginProgrammatically(String name, String path) {
        WebSession session = SESSIONS.get(name);
        if (session == null) {
            throw new IllegalStateException("No saved web login \"" + name + "\": log in on the UI once and call saveSession(\""
                    + name + "\") first");
        }
        String origin = session.origin();
        String target = origin + (path == null || path.isBlank() ? "/" : path.startsWith("/") ? path : "/" + path);

        if (!driver.getCurrentUrl().startsWith(origin)) {
            driver.get(origin + "/robots.txt");
        }
        for (org.openqa.selenium.Cookie cookie : session.cookies()) {
            try {
                driver.manage().addCookie(cookie);
            } catch (Exception e) {
                System.out.println("Could not put back the cookie " + cookie.getName() + ": " + e.getMessage().split("\n")[0]);
            }
        }

        com.google.gson.Gson gson = new com.google.gson.Gson();
        // exactly the saved state: keys a later test added (a cart, a draft) must not come along
        StringBuilder writes = new StringBuilder("localStorage.clear();");
        session.localStorage().forEach((k, v) -> writes.append("localStorage.setItem(").append(gson.toJson(k))
                .append(", ").append(gson.toJson(v)).append(");"));

        if (driver instanceof org.openqa.selenium.chromium.ChromiumDriver chromium) {
            // only on the app's own origin - not in the reCAPTCHA / other frames the page loads
            String script = "if (location.origin === " + gson.toJson(origin) + ") {" + writes + "}";
            Object id = chromium.executeCdpCommand("Page.addScriptToEvaluateOnNewDocument",
                    java.util.Map.of("source", script)).get("identifier");
            try {
                driver.get(target);
            } finally {
                // one-shot: later loads (and a test that logs out) must not get the keys again
                chromium.executeCdpCommand("Page.removeScriptToEvaluateOnNewDocument",
                        java.util.Map.of("identifier", id));
            }
            return;
        }

        driver.get(origin + "/robots.txt");
        ((JavascriptExecutor) driver).executeScript(writes.toString());
        driver.get(target);
    }
}
