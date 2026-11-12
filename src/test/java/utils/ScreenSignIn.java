package utils;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import java.util.Map;

/**
 * Trova (Omar 2026-10-23) - one sign-in on the screen with the login's saved steps (learned by the AI agent: {url,
 * steps: [{fill: selector, field: login field} | {click: selector} | {wait: ms}], done}), the values from Test Data →
 * Credentials. Selectors are css or text=&lt;button text&gt;, found the way the AI agent finds them. Used when the kept
 * sign-in no longer works; the new state is then kept again. Never logs a value.
 */
final class ScreenSignIn {

    /** the agent's own finder (trova-browser.js FIND_SRC): css, text=..., x:has-text("...") - visible elements only */
    static final String FIND = "var sel = arguments[0];"
            + "var seen = function (e) { var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };"
            + "var byText = function (scope, text) { text = text.trim().replace(/^['\"]|['\"]$/g, '').toLowerCase(); var all;"
            + "  try { all = Array.prototype.slice.call(document.querySelectorAll(scope || '*')); } catch (e) { return []; }"
            + "  return all.filter(function (e) { return seen(e) && ((e.innerText || e.value || '') + '').trim().toLowerCase().indexOf(text) >= 0; }); };"
            // Omar 2026-10-25: text=إرسال must press "إرسال" (Send), not "إعادة إرسال" (Resend) - exact text and pressable first
            + "var best = function (list, text) { text = text.trim().replace(/^['\"]|['\"]$/g, '').toLowerCase();"
            + "  var exact = function (e) { return ((e.innerText || e.value || '') + '').trim().toLowerCase() === text; };"
            + "  var on = function (e) { return !e.disabled && e.getAttribute('aria-disabled') !== 'true'; };"
            + "  var pick = function (f) { for (var k = 0; k < list.length; k++) if (f(list[k])) return list[k]; return null; };"
            + "  return pick(function (e) { return exact(e) && on(e); }) || pick(exact) || pick(on) || list[0]; };"
            + "var parts = String(sel).split(/,(?![^(]*\\))/).map(function (s) { return s.trim(); }).filter(Boolean);"
            + "for (var i = 0; i < parts.length; i++) { var one = parts[i];"
            + "  var t = /^text=([\\s\\S]+)$/.exec(one);"
            + "  if (t) { var b = best(byText('button, a, [role=button], input[type=submit], input[type=button]', t[1]), t[1]); if (b) return b; continue; }"
            + "  var h = /^([\\s\\S]*?):has-text\\((['\"])([\\s\\S]*)\\2\\)$/.exec(one);"
            + "  if (h) { var l = byText(h[1] || '*', h[3]); if (l.length) return l[l.length - 1]; continue; }"
            + "  try { var e = document.querySelector(one); if (e) return e; } catch (x) {} }"
            + "return null;";

    private ScreenSignIn() {
    }

    /**
     * signs in on the screen; throws with plain words when it did not get through (what the app says, if anything). A
     * step whose box or button is gone is found again the way the AI agent does (trova-login-field.js): the code box by its
     * kind inside the open dialog (never the account-code box), the dialog's confirm button; the healed steps are kept
     * for Trova ({@link KeptSignIn#keepRecipe}) so the next run starts from them.
     */
    static void run(WebDriver driver, String url, String login, JsonObject saved) {
        started = System.currentTimeMillis();
        try {
            runOnce(driver, url, login, saved);
        } catch (org.openqa.selenium.WebDriverException e) {
            // Omar 2026-10-25: one plain reason, never the browser's raw error; no waiting for a new code (the caller reuses the saved sign-in)
            String says = said(driver);
            throw new IllegalStateException(!says.isBlank() ? SignInRefusal.words(appName(url), says, false)
                    : appName(url) + " did not let the sign-in through: the sign-in page changed while Trova was typing ("
                    + e.getClass().getSimpleName() + ")", e);
        }
    }

    private static void runOnce(WebDriver driver, String url, String login, JsonObject saved) {
        JsonObject recipe = saved.deepCopy();
        String start = recipe.has("url") && !recipe.get("url").getAsString().isBlank() ? recipe.get("url").getAsString() : url;
        String done = recipe.has("done") ? recipe.get("done").getAsString() : "";
        driver.get(start);
        Map<String, String> fields = Credentials.of(login);
        JsonArray steps = recipe.getAsJsonArray("steps");
        boolean healed = false;
        for (int i = 0; i < steps.size(); i++) {
            JsonObject step = steps.get(i).getAsJsonObject();
            if (step.has("wait")) { // TICKET-989: wait for the next step's box / button (or the signed-in page), not a fixed time
                waitFor(driver, steps, i, Math.min(step.get("wait").getAsLong(), 10000), done, start);
                continue;
            }
            String selector = step.has("fill") ? step.get("fill").getAsString() : step.has("click") ? step.get("click").getAsString() : null;
            if (selector == null) continue;
            WebElement e = find(driver, selector, 8000);
            String fix = e != null ? "ok" : heal(driver, step, steps, i);
            if (fix == null && SignInPage.signedIn(driver, done, start) == null) break; // the page moved on: already in
            if (fix == null) {
                String says = said(driver); // e.g. "you cannot ask for a new code yet": the app's own reason first
                if (!says.isBlank()) throw new IllegalStateException(SignInRefusal.words(appName(url), says, false));
                throw new IllegalStateException("Signing in as \"" + login + "\" on the screen stopped: the page has no " + selector
                        + " any more - run an AI session that signs in as " + login + " once, so Trova learns the new sign-in page");
            }
            if ("skip".equals(fix)) continue;
            if (e == null) {
                healed = true;
                e = find(driver, step.has("fill") ? step.get("fill").getAsString() : step.get("click").getAsString(), 2000);
                if (e == null) throw new IllegalStateException(SignInRefusal.words(appName(url), said(driver), false));
            }
            String now = step.has("fill") ? step.get("fill").getAsString() : step.get("click").getAsString(); // healed = its new selector
            if (step.has("click")) {
                SignInAct.click(driver, now, e); // Omar 2026-10-25: found again when the form redraws
            } else {
                String field = step.get("field").getAsString();
                String value = fields.entrySet().stream().filter(f -> f.getKey().equalsIgnoreCase(field) && f.getValue() != null && !f.getValue().isBlank())
                        .map(Map.Entry::getValue).findFirst().orElseGet(() -> codeFromInbox(login, field));
                SignInAct.type(driver, now, e, value);
                if ("submit".equals(fix)) { // a healed code box: press its dialog's confirm button once it is there
                    WaitedReads.within(driver, 3000, 200, d -> SignInPage.button(d, true));
                }
            }
        }
        if (WaitedReads.within(driver, 20000, 400, d -> SignInPage.signedIn(d, done, start) == null) != null) {
            if (healed) KeptSignIn.keepRecipe(login, recipe);
            return;
        }
        String says = said(driver);
        String page = SignInPage.signedIn(driver, done, start); // Omar 2026-10-25: no toast - say where it stopped
        if (says.isBlank() && page != null) throw new IllegalStateException(appName(url) + " did not let the sign-in through: " + page);
        throw new IllegalStateException(SignInRefusal.words(appName(url), says, false));
    }

    /**
     * Omar 2026-10-25: a one-time code with no fixed code on the login comes from the Test Data e-mail inbox (the code in
     * the newest e-mail since this sign-in began), the same source the AI runs use; else it says plainly what is missing.
     */
    private static String codeFromInbox(String login, String field) {
        if (!"otp".equals(SignInPage.family(field)) || TestData.email().mailbox().isBlank()) throw new IllegalStateException(missing(login, field));
        try {
            String code = EmailReader.waitFor(null, body -> EmailReader.CODE.matcher(body).find(), started - 5000, 90).value(EmailReader.CODE);
            if (code != null) return code;
        } catch (RuntimeException | AssertionError e) {
            throw new IllegalStateException("Signing in as \"" + login + "\" needs the one-time code from the e-mail inbox, and it did not come: "
                    + e.getMessage(), e);
        }
        throw new IllegalStateException("Signing in as \"" + login + "\" needs a one-time code, and the newest e-mail in the inbox has none");
    }

    /**
     * TICKET-980: a value the screen sign-in needs is not saved. A one-time code needs a fixed code on the login or the
     * Test Data e-mail inbox, else Trova cannot sign in again on its own when a short sign-in runs out - said plainly.
     */
    static String missing(String login, String field) {
        if ("otp".equals(SignInPage.family(field)) && TestData.email().mailbox().isBlank()) {
            return "Signing in as \"" + login + "\" needs a one-time code, and Trova has neither a fixed code for this login nor an"
                    + " e-mail inbox in Test Data - add a fixed code (" + field + ") in Test Data → Credentials or the inbox in Test Data"
                    + " → Environments, so Trova can sign in again by itself when the sign-in runs out";
        }
        return "The login \"" + login + "\" has no " + field + " - add it in Test Data → Credentials";
    }

    /** 'healed' (step changed), 'submit' (healed box, then the dialog's button), 'skip' (a click left over), or null */
    private static String heal(WebDriver driver, JsonObject step, JsonArray steps, int at) {
        if (step.has("fill")) {
            String alt = SignInPage.pick(driver, step.has("field") ? step.get("field").getAsString() : "");
            if (alt == null) return null;
            step.addProperty("fill", join(alt, step.get("fill").getAsString()));
            for (int j = at + 1; j < steps.size(); j++) {
                JsonObject next = steps.get(j).getAsJsonObject();
                if (next.has("fill")) return "submit";
                if (next.has("click")) return "healed";
            }
            return "submit";
        }
        String text = SignInPage.button(driver, false);
        if (text != null) {
            step.addProperty("click", join("text=" + text, step.get("click").getAsString()));
            return "healed";
        }
        return SignInPage.midSignIn(driver) ? null : "skip";
    }

    /** "new, old" - the finder takes the first that is there, so both pages keep working */
    private static String join(String alt, String old) {
        if (old == null || old.isBlank() || "[data-fia-none]".equals(old)) return alt;
        for (String one : old.split(",")) if (one.trim().equals(alt)) return old;
        return alt + ", " + old;
    }

    /**
     * what the app says on the page (a toast, an error under a box), else (Omar 2026-10-25) what its API answered when it
     * refused the sign-in's last call (a toast that is gone, or none at all), or ""
     */
    private static String said(WebDriver driver) {
        try {
            Object said = ((JavascriptExecutor) driver).executeScript("var l = document.querySelectorAll('.toast-message, .toast, [role=alert], .error, .invalid-feedback,"
                    + " mat-error, .mat-mdc-snack-bar-label, .mat-snack-bar-container, .swal2-html-container, .p-toast-detail, .ant-message-notice, [class*=toast] [class*=message]');"
                    + "for (var i = 0; i < l.length; i++) { var t = (l[i].innerText || '').trim(); if (t) return t.slice(0, 200); } return '';");
            if (said != null && !String.valueOf(said).isBlank()) return String.valueOf(said);
        } catch (Exception e) {
            // the page did not answer: the API's answer below
        }
        return NetworkRecorder.lastRefusal(started);
    }

    /** when this sign-in began: only the app's answers after it count */
    private static volatile long started;

    static String appName(String url) {
        try {
            String host = java.net.URI.create(url).getHost();
            String[] parts = host.split("\\.");
            String name = parts.length > 1 && parts[0].matches("(?i)www|app|portal|web|test|stage|dev") ? parts[1] : parts[0];
            name = name.replaceAll("[-_].*$", "");
            return name.isEmpty() ? "The app" : Character.toUpperCase(name.charAt(0)) + name.substring(1);
        } catch (Exception e) {
            return "The app";
        }
    }

    static WebElement find(WebDriver driver, String selector, int ms) {
        return WaitedReads.within(driver, ms, 300, d -> ((JavascriptExecutor) d).executeScript(FIND, selector) instanceof WebElement w ? w : null);
    }

    /** a learned "wait" step: up to {@code ms} until the next box / button is there, or the page is signed in */
    private static void waitFor(WebDriver driver, JsonArray steps, int at, long ms, String done, String start) {
        String next = null;
        for (int j = at + 1; j < steps.size() && next == null; j++) {
            JsonObject s = steps.get(j).getAsJsonObject();
            next = s.has("fill") ? s.get("fill").getAsString() : s.has("click") ? s.get("click").getAsString() : null;
        }
        String selector = next;
        WaitedReads.within(driver, ms, 300, d -> (selector != null && ((JavascriptExecutor) d).executeScript(FIND, selector) instanceof WebElement)
                || SignInPage.signedIn(d, done, start) == null);
    }
}
