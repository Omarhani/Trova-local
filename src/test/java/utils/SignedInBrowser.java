package utils;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.openqa.selenium.WebDriver;

import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.Map;

/**
/**
 * Omar 2026-10-25 - "Log in programmatically" for any app, API FIRST, and never a sign-in page inside a suite run:
 *
 * <ol>
 *   <li>The login's sign-in recipe from Test Data → Programmatically ({@link ApiSignIn}: the app's own sign-in calls,
 *   learned by Trova) runs ONCE per run; its keys go into the browser before the app starts (one-shot script on the
 *   app's origin, {@link BrowserState#restore}) with Test Data → Browser storage on top, the app opens and the page is
 *   checked signed in. Every later block and the API clean-up reuse that one sign-in.</li>
 *   <li>Older projects: their own API sign-in ({@code api.client.AppSession} / {@code apis.services.AppSession}:
 *   {@code public static Map<String, Map<String, String>> session(String login)}).</li>
 *   <li>Fallback only: the sign-in state Trova keeps for this login ({@link KeptSignIn}), then the app's refresh call.</li>
 *   <li>Else the run stops once with the reason. A suite never signs in on the screen (Omar 2026-10-25, hard rule): the
 *   screen sign-in only happens when the AI learns the recipe, or in a test whose subject is the sign-in page itself.</li>
 * </ol>
 */
public final class SignedInBrowser {

    private static final Gson GSON = new Gson();
    /** The house place first, then the older starter's place (projects made before the Availo layout). */
    private static final String[] PROVIDERS = {"api.client.AppSession", "apis.services.AppSession"};

    private SignedInBrowser() {
    }

    /**
     * Opens {@code url} signed in as {@code login} (a Trova Test Data login name). Omar 2026-10-25 (online run #14): a
     * project's older BaseTests calls this in every block - it goes through the run's ONE sign-in ({@link SignedInRun}).
     */
    public static void open(WebDriver driver, String url, String login) {
        SignedInRun.open(driver, url, login);
    }

    /** the run's first sign-in as {@code login} */
    static void first(WebDriver driver, String url, String login) {
        MidRunSignIn.watch(driver, url, login); // TICKET-980: a step that finds the app signed out signs in again once
        signIn(driver, url, login);
    }

    /** a test block after the run's one sign-in: the same API sign-in's keys go back in (no new sign-in) */
    static void reuse(WebDriver driver, String url, String login) {
        MidRunSignIn.watch(driver, url, login);
        signIn(driver, url, login);
    }

    /** TICKET-980: a step found the app signed out - the kept keys again, else the app's refresh call; never the screen */
    static void again(WebDriver driver, String url, String login) {
        BrowserState.clear(driver);
        signIn(driver, url, login);
    }

    /** API recipe → the project's own API sign-in → kept state → the app's refresh call → stop with the reason */
    private static void signIn(WebDriver driver, String url, String login) {
        JsonObject recipe = KeptSignIn.recipe(login);
        String done = recipe != null && recipe.has("done") ? recipe.get("done").getAsString() : null;
        String start = recipe != null && recipe.has("url") ? recipe.get("url").getAsString() : null;
        JsonObject kept = KeptSignIn.state(login);
        String why = null;
        if (ApiSignIn.has(login)) {
            try {
                if (put(driver, url, login, kept, ApiSignIn.signIn(login).browser(), done, start)) return;
                why = ScreenSignIn.appName(url) + " did not open signed in with the keys of its own sign-in calls - the sign-in"
                        + " recipe of \"" + login + "\" needs learning again (one AI session that signs in)";
            } catch (IllegalStateException e) {
                why = e.getMessage();
            }
            System.out.println("Signing in as " + login + " by API did not work: " + why);
        }
        if (why == null && provider() != null && !TestData.apiHeaders().isEmpty()) {
            try {
                Map<String, Map<String, String>> session = byApi(login);
                if (session != null && put(driver, url, login, kept, session, done, start)) return;
                why = "Signing in as \"" + login + "\" by API worked, but the app did not open signed in with it";
            } catch (IllegalStateException e) {
                why = e.getMessage();
            }
        }
        if (kept != null && !SignInClock.of(kept).expired()) { // fallback: the sign-in Trova kept
            if (tryState(driver, url, kept, done, start) == null) {
                if (why != null) System.out.println("The saved sign-in of " + login + " still works - the run uses it");
                return;
            }
            BrowserState.clear(driver);
        }
        if (kept != null && AppRefreshCall.known()) {
            try {
                JsonObject fresh = AppRefreshCall.refresh(kept);
                if (fresh != null && tryState(driver, url, fresh, done, start) == null) {
                    System.out.println("The sign-in of " + login + " was refreshed with the app's own refresh call");
                    KeptSignIn.keep(login, fresh);
                    return;
                }
                if (fresh != null) BrowserState.clear(driver);
            } catch (IllegalStateException e) {
                if (why == null) why = e.getMessage();
            }
        }
        throw new IllegalStateException(why != null ? why : "Trova cannot sign in as \"" + login + "\" on " + TestData.env()
                + " yet: there is no sign-in recipe for it - run an AI session that signs in as " + login
                + " once (Trova learns the app's own sign-in calls), then run the suite again");
    }

    /** the API's keys over the kept state (theme, language ... stay), else alone; true when the app opened signed in */
    private static boolean put(WebDriver driver, String url, String login, JsonObject kept, Map<String, Map<String, String>> keys,
                               String done, String start) {
        Map<String, Map<String, String>> settings = PageSettings.of(login); // Omar 2026-10-27: what the sign-in page writes first
        settings = PageSettingsCapture.orRead(driver, url, login, settings); // Omar 2026-10-27: an older sign-in - read once now
        for (JsonObject merged : kept != null ? new JsonObject[] {SignInRefresh.merged(kept, keys, url), SignInRefresh.merged(null, keys, url)}
                : new JsonObject[] {SignInRefresh.merged(null, keys, url)}) {
            JsonObject state = PageSettings.addMissing(merged, settings);
            if (tryState(driver, url, state, done, start) == null) {
                KeptSignIn.keep(login, state);
                return true;
            }
            BrowserState.clear(driver);
        }
        return false;
    }

    /** restores the whole state before the app starts and checks it is signed in: null when it is, else why not */
    private static String tryState(WebDriver driver, String url, JsonObject state, String done, String start) {
        BrowserState.restore(driver, url, StorageModes.onTop(state, url)); // Omar 2026-10-25: browser storage before the first page
        String why = BrowserState.check(driver, state, done, start);
        if (why == null) BrowserStorage.stayed(driver); // Omar 2026-10-25: one page load - read back, no reload
        if (why == null) PageLook.note(driver); // Omar 2026-10-27: says so when the page opens unstyled
        return why;
    }

    /** Opens {@code url} with this session already in the browser (the API sign-in's shape: storage maps, cookie map). */
    public static void open(WebDriver driver, String url, Map<String, Map<String, String>> session) {
        java.net.URI target = java.net.URI.create(url);
        JsonObject state = new JsonObject();
        state.addProperty("origin", target.getScheme() + "://" + target.getAuthority());
        state.addProperty("at", url);
        state.add("localStorage", GSON.toJsonTree(session.getOrDefault("localStorage", Map.of())));
        state.add("sessionStorage", GSON.toJsonTree(session.getOrDefault("sessionStorage", Map.of())));
        JsonArray cookies = new JsonArray();
        session.getOrDefault("cookies", Map.of()).forEach((k, v) -> {
            JsonObject c = new JsonObject();
            c.addProperty("name", k);
            c.addProperty("value", v);
            c.addProperty("path", "/");
            cookies.add(c);
        });
        state.add("cookies", cookies);
        BrowserState.restore(driver, url, state);
    }

    /** What the app keeps in the browser now (after a login on the screen): local storage, session storage, cookies. */
    public static Map<String, Map<String, String>> capture(WebDriver driver) {
        JsonObject state = BrowserState.read(driver);
        Map<String, Map<String, String>> session = new LinkedHashMap<>();
        session.put("localStorage", strings(state.getAsJsonObject("localStorage")));
        session.put("sessionStorage", strings(state.getAsJsonObject("sessionStorage")));
        Map<String, String> cookies = new LinkedHashMap<>();
        state.getAsJsonArray("cookies").forEach(c -> cookies.put(c.getAsJsonObject().get("name").getAsString(),
                c.getAsJsonObject().get("value").getAsString()));
        session.put("cookies", cookies);
        return session;
    }

    /** Keeps the state the browser has now for this login (after a sign-in on the screen) - Trova gets it after the run. */
    public static void save(WebDriver driver, String login) {
        try {
            KeptSignIn.keep(login, BrowserState.read(driver));
        } catch (Exception e) {
            System.out.println("The signed-in session could not be saved: " + e.getClass().getSimpleName());
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Map<String, String>> byApi(String login) {
        try {
            Method session = provider().getMethod("session", String.class);
            return (Map<String, Map<String, String>>) session.invoke(null, login);
        } catch (ReflectiveOperationException e) {
            Throwable cause = e.getCause() == null ? e : e.getCause();
            String said = cause.getMessage() == null ? "" : cause.getMessage();
            throw new IllegalStateException(said.matches("(?s)^(\\S+ (refused: |did not let )|The sign-in did not get through).*")
                    ? said : SignInRefusal.words(ScreenSignIn.appName(TestData.webUrl()), said, true), cause);
        }
    }

    private static Class<?> provider() {
        for (String name : PROVIDERS) {
            try {
                return Class.forName(name);
            } catch (ClassNotFoundException next) {
                // try the next place
            }
        }
        return null;
    }

    private static Map<String, String> strings(JsonObject o) {
        Map<String, String> out = new LinkedHashMap<>();
        o.entrySet().forEach(e -> out.put(e.getKey(), e.getValue().isJsonNull() ? null : e.getValue().getAsString()));
        return out;
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
