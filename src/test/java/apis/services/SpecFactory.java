package apis.services;

import io.restassured.builder.RequestSpecBuilder;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import utils.ApiReport;


/**
 * The request spec every API client starts from: the running env's API host (ENVIRONMENTS.&lt;env&gt;.API_BASE_URI),
 * JSON in and out, the data file's API.HEADERS on every call, and {@link ApiReport#FILTER} - so every call lands in
 * the running test's report entry and in the Live Runner feed, with its secrets masked.
 */
/** Kept for projects made from the older starter (their API code calls it); new code uses api.client.ApiClient. */
@Deprecated
public final class SpecFactory {

    private SpecFactory() {
    }

    /** The web API of the running env, under {@code resource} (e.g. "booking"; "" for the host itself). */
    public static RequestSpecification getSpec(String resource) {
        return spec(utils.TestData.apiUrl(), resource);
    }

    /** The mobile app's API of the running env (MOBILE_API_BASE_URI, or API_BASE_URI when that is empty). */
    public static RequestSpecification getMobileSpec(String resource) {
        return spec(utils.TestData.mobileApiUrl(), resource);
    }

    private static RequestSpecification spec(String baseUri, String resource) {
        if (baseUri == null || baseUri.isBlank()) {
            throw new IllegalStateException("No API address for the " + utils.TestData.env()
                    + " environment: add it in Trova → Test Data → Environments");
        }
        RequestSpecBuilder builder = new RequestSpecBuilder()
                .setBaseUri(baseUri)
                .setBasePath(resource == null ? "" : resource)
                .setContentType(ContentType.JSON)
                .setAccept(ContentType.JSON)
                .addFilter(ApiReport.FILTER);
        utils.TestData.apiHeadersForOneCall().forEach(builder::addHeader); // fixed + a fresh per-call id (Trova 2026-10-23)
        return builder.build();
    }
}
