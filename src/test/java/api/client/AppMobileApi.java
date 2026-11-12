package api.client;

/** The app's API as the phone app calls it: the environment's mobile API address, or the web one when that is empty. */
public class AppMobileApi extends ApiClient {

    private String login;

    /**
     * Omar 2026-10-27: a client signed in as {@code login} (Test Data login name) the way the phone app signs in - for a
     * set-up only that user can make (the employee sends the request, the case's own login decides it).
     */
    public static AppMobileApi signedInAs(String login) {
        AppMobileApi api = new AppMobileApi();
        api.login = login;
        try {
            api.token = utils.PhoneSignIn.bearer(login);
        } catch (IllegalStateException refused) { // Omar 2026-10-27: no sign-in = the set-up made nothing - skipped with the reason, never retried
            utils.SetupHandOver.signInRefused(refused.getMessage()); // the set-up skips even when its code catches this
            throw new org.testng.SkipException("Not tested - " + refused.getMessage());
        }
        return api;
    }

    @Override
    protected String baseUri() {
        return utils.TestData.mobileApiUrl();
    }

    @Override
    protected java.util.Map<String, String> extraHeaders() {
        return login == null ? java.util.Map.of() : utils.PhoneSignIn.headers(login);
    }

    @Override
    protected Object shaped(Object body) {
        return login == null ? body : utils.PhoneSignIn.wrap(login, body);
    }

    @Override
    protected String signInAgain() {
        return login == null ? null : utils.PhoneSignIn.bearer(login);
    }

    /** Omar 2026-10-27: the signed-in phone user's id and account id, as the phone app sends them in its request bodies */
    // Omar 2026-10-27: never a silent null id - signs in again once, else a plain error
    @Override
    protected String side() {
        return "MOBILE";
    }

    @Override
    protected java.util.Map<String, String> signInValues() {
        return login == null ? java.util.Map.of() : utils.PhoneSignIn.values(login);
    }

    public String userId() {
        return login == null ? null : utils.PhoneSignIn.required(login, "USER_ID");
    }

    public String accountId() {
        return login == null ? null : utils.PhoneSignIn.required(login, "ACCOUNT_ID");
    }
}
