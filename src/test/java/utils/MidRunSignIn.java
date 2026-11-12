package utils;

import com.google.gson.JsonObject;
import org.openqa.selenium.WebDriver;

/**
 * Trova TICKET-980 (Omar 2026-10-23) - the test side of {@link SignedOutStep} for a test opened signed in
 * ({@link SignedInBrowser#open}): after a failed step the app counts as signed out when it shows its sign-in page or a
 * password / code box, or one of its calls just answered 401 / 403 with an expired-token message; then Trova signs in
 * again (Omar 2026-10-25: only a quiet refresh - API sign-in or the app's refresh call, never the screen), goes back to the page the step was on and the step
 * is tried once more. A refused sign-in stops the test with the app's reason in plain words.
 */
final class MidRunSignIn implements SignedOutStep.Watcher {

    private final String url;
    private final String login;

    private MidRunSignIn(String url, String login) {
        this.url = url;
        this.login = login;
    }

    /** watch this browser for the rest of the test */
    static void watch(WebDriver driver, String url, String login) {
        SignedOutStep.watch(driver, new MidRunSignIn(url, login));
    }

    @Override
    public boolean signedOut(WebDriver driver) {
        if (SignOutSigns.within(30_000)) return true;
        JsonObject recipe = KeptSignIn.recipe(login);
        String done = recipe != null && recipe.has("done") ? recipe.get("done").getAsString() : null;
        String start = recipe != null && recipe.has("url") ? recipe.get("url").getAsString() : null;
        String page = SignInPage.signedIn(driver, done, start);
        return page != null && (page.contains("sign-in page") || page.contains("asks for its code"));
    }

    @Override
    public void signInAgain(WebDriver driver, String at) {
        SignedInBrowser.again(driver, url, login);
        if (at != null && at.startsWith("http") && !at.equals(url) && !onSignIn(at)) driver.get(at); // back where the step was
    }

    private boolean onSignIn(String at) {
        JsonObject recipe = KeptSignIn.recipe(login);
        String start = recipe != null && recipe.has("url") ? recipe.get("url").getAsString() : "";
        String path = start.replaceAll("^[a-z]+://[^/]+", "").replaceAll("[?].*$", "");
        return (path.length() > 2 && at.contains(path)) || at.matches("(?i).*[/#](log-?in|sign-?in|signin|auth|sso)([/?#].*)?$");
    }
}
