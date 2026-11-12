package api.services;

import api.client.ApiClient;
import io.restassured.response.Response;

/** The API's health address: answers whether the server is up. Tests own the check, this class only calls. */
public class HealthApi extends BaseService<ApiClient> {

    public HealthApi(ApiClient client) {
        super(client);
    }

    /** GET the health path ("" = the API's root). */
    public Response answer(String path) {
        return client.get(path);
    }
}
