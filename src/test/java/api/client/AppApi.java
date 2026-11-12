package api.client;

/**
 * The app's API as its web side calls it. Omar 2026-10-25: {@link #signedInAs(String)} = the run's ONE API sign-in
 * (Test Data → Programmatically: the app's own sign-in calls) - the same token the browser got, for set-up and clean-up.
 */
public class AppApi extends ApiClient {

    private String login;

    /** a client with the token of the run's sign-in as {@code login} (Test Data login name) */
    public static AppApi signedInAs(String login) {
        AppApi api = new AppApi();
        api.login = login;
        api.token = utils.SignInToken.bearer(login);
        return api;
    }

    @Override
    protected java.util.Map<String, String> signInValues() { // Omar 2026-10-27: the ids a known body needs
        return login == null ? java.util.Map.of() : utils.ApiSignIn.values(login);
    }

    @Override
    protected String signInAgain() {
        return login == null ? null : utils.SignInToken.bearer(login);
    }
}
