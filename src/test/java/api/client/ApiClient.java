package api.client;

import io.restassured.builder.RequestSpecBuilder;
import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import io.restassured.response.Response;
import io.restassured.specification.RequestSpecification;
import utils.ApiReport;

import static io.restassured.RestAssured.given;

/**
 * The transport every API client stands on: the running env's API host (Trova → Test Data → Environments), JSON in
 * and out, the environment's API headers on every call, and {@link ApiReport#FILTER} - so every call lands in the
 * running test's report entry and in the Live Runner feed, with its secrets masked. One subclass per side of the app
 * ({@link AppApi} for what the web app calls, {@link AppMobileApi} for the phone app): login, token, body wrapping.
 */
public abstract class ApiClient {

    /** Set by a client after its login; sent as a Bearer header when not empty. */
    protected String token = "";

    /** The host this client calls; the phone app's client overrides it. */
    protected String baseUri() {
        return utils.TestData.apiUrl();
    }

    protected RequestSpecification spec() {
        String baseUri = baseUri();
        if (baseUri == null || baseUri.isBlank()) {
            throw new IllegalStateException("No API address for the " + utils.TestData.env()
                    + " environment: add it in Trova → Test Data → Environments");
        }
        RequestSpecBuilder builder = new RequestSpecBuilder()
                .setBaseUri(baseUri)
                .setContentType("application/json; charset=UTF-8") // Omar 2026-10-27: a text body was sent as ISO-8859-1 and the app read it as empty
                .setAccept(ContentType.JSON)
                .addFilter(ApiReport.FILTER);
        if (!"MOBILE".equalsIgnoreCase(side())) // Omar 2026-10-27: the web app's fixed headers (ServiceKey ...) made the phone API read the body as empty
            utils.TestData.apiHeadersForOneCall().forEach((k, v) -> { if (!transport(k)) builder.addHeader(k, v); }); // fixed + a fresh per-call id (Trova 2026-10-23)
        extraHeaders().forEach((k, v) -> { if (!transport(k)) builder.addHeader(k, v); }); // Omar 2026-10-27: e.g. the phone app's own headers
        if (!token.isEmpty()) {
            builder.addHeader("Authorization", "Bearer " + token);
        }
        return builder.build();
    }

    /**
     * Signs in again and returns the new token - override it in a client that signs in (call its login, return the
     * token); null = this client cannot (the default). Trova TICKET-980: used when the token runs out within
     * min(2 min, 20% of its life) and once when a call answers 401.
     */
    protected String signInAgain() {
        return null;
    }

    /** Omar 2026-10-27: a copied content-length / content-type emptied the body (Availo "A non-empty request body is required") */
    static boolean transport(String name) {
        String n = name == null ? "" : name.trim().toLowerCase(java.util.Locale.ROOT);
        return n.equals("content-length") || n.equals("content-type") || n.equals("host") || n.equals("connection")
                || n.equals("accept-encoding") || n.equals("transfer-encoding") || n.equals("accept");
    }

    /** Omar 2026-10-27: "/x" on a base ending in "/api/" made "/api//x", which the server read as an empty body */
    static String path(String endpoint) {
        String p = endpoint == null ? "" : endpoint.trim();
        while (p.startsWith("/")) p = p.substring(1);
        return p;
    }

    /** headers the app adds to every call (none by default) */
    protected java.util.Map<String, String> extraHeaders() {
        return java.util.Map.of();
    }

    /** the body as the app sends it (as given by default; the phone app puts it in its envelope) */
    protected Object shaped(Object body) {
        return body;
    }

    public Response get(String endpoint) {
        return send(s -> s.get(path(endpoint)));
    }

    public Response post(String endpoint, Object body) {
        return send(s -> s.body(shaped(body)).post(path(endpoint)));
    }

    public Response put(String endpoint, Object body) {
        return send(s -> s.body(shaped(body)).put(path(endpoint)));
    }

    public Response delete(String endpoint) {
        return send(s -> s.delete(path(endpoint)));
    }

    public Response patch(String endpoint, Object body) {
        return send(s -> s.body(shaped(body)).patch(path(endpoint)));
    }

    /** Omar 2026-10-27: WEB or MOBILE - the Endpoints catalog side this client calls */
    protected String side() {
        return "WEB";
    }

    /** Omar 2026-10-27: the values this client's sign-in kept (e.g. USER_ID, ACCOUNT_ID); empty when none */
    protected java.util.Map<String, String> signInValues() {
        return java.util.Map.of();
    }

    /**
     * Omar 2026-10-27 (writer 290 / 292 invented bodies): a catalog endpoint ("POST /api/x") with the body Trova KNOWS for
     * it (utils.KnownCall: the passed AI walk's, else the catalog's), filled with this sign-in's ids and {@code values} by
     * field name - never a hand-made body. Unknown to Trova: a plain error naming the endpoint.
     */
    public Response call(String endpoint, java.util.Map<String, ?> values) {
        String[] mp = utils.KnownCall.split(endpoint);
        utils.KnownCall.Known known = utils.KnownCall.find(side(), mp[0], mp[1]);
        String method = !mp[0].isEmpty() ? mp[0] : known != null ? known.method() : "GET";
        if (known == null && !"GET".equals(method) && !"DELETE".equals(method)) {
            throw new IllegalStateException("Trova knows no body for " + method + " " + mp[1] + " (" + side()
                    + " side) - it is not on the Endpoints page and no passed AI walk called it");
        }
        String to = utils.KnownCall.path(mp[1], values);
        String body = utils.KnownCall.body(known, signInValues(), values);
        return switch (method) {
            case "POST" -> post(to, body == null ? "{}" : body);
            case "PUT" -> put(to, body == null ? "{}" : body);
            case "PATCH" -> patch(to, body == null ? "{}" : body);
            case "DELETE" -> delete(to);
            default -> get(to);
        };
    }

    public Response call(String endpoint) {
        return call(endpoint, java.util.Map.of());
    }

    /** one call; a token about to run out is renewed first, and a 401 renews it and tries the call once more - never a loop */
    private Response send(java.util.function.Function<RequestSpecification, Response> call) {
        if (!token.isEmpty() && utils.SignInClock.ofToken(token).soon()) renew("the sign-in runs out " + utils.SignInClock.ofToken(token).words());
        Response answer = call.apply(given(spec()));
        if (answer.statusCode() == 401 && !token.isEmpty() && renew("the call answered 401")) answer = call.apply(given(spec()));
        return answer;
    }

    private boolean renew(String why) {
        String fresh = signInAgain();
        if (fresh == null || fresh.isBlank()) return false;
        System.out.println("Signing in again by API: " + why);
        token = fresh;
        return true;
    }

    /** The answer's JSON when the call worked (HTTP 2xx); otherwise fails with the endpoint and what the server said. */
    public static JsonPath ok(Response response, String endpoint) {
        int status = response.statusCode();
        if (status < 200 || status >= 300) {
            String body = response.asString();
            throw new AssertionError(endpoint + " answered HTTP " + status
                    + (body == null || body.isBlank() ? "" : ": " + (body.length() > 300 ? body.substring(0, 300) + "…" : body)));
        }
        return response.jsonPath();
    }
}
