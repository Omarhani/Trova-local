package api.services;

import api.client.ApiClient;

/** Parent of every service object (one per API area): it rides on a client, signed in or not. */
public abstract class BaseService<C extends ApiClient> {

    protected final C client;

    protected BaseService(C client) {
        this.client = client;
    }
}
