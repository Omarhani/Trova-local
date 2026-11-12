package api.services;

import api.client.ApiClient;
import api.client.AppApi;

import java.util.List;
import java.util.Map;

/** Invoices by API (web side). An invoice cannot be deleted - the clean-up cancels it, as the app's own Cancel does. */
public final class InvoiceApi {

    /** run-context key: the ids of the invoices this run made */
    public static final String MADE_INVOICES = "invoiceIds";

    private InvoiceApi() {
    }

    /** The id of the invoice with this exact number, read back from the list right after the save; null when not found. */
    public static String idOf(AppApi api, String number) {
        List<Map<String, Object>> rows = ApiClient.ok(api.get("api/invoices?pageNumber=1&pageSize=15&search=" + number),
                "GET /api/invoices").getList("items");
        if (rows != null) for (Map<String, Object> r : rows) {
            if (number.equals(String.valueOf(r.get("number")))) return String.valueOf(r.get("id"));
        }
        return null;
    }

    /** The invoice's status: Pending, Paid, Cancelled ... */
    public static String status(AppApi api, String id) {
        return ApiClient.ok(api.get("api/invoices/" + id), "GET /api/invoices/{id}").getString("status");
    }

    /** Cancels the invoice; the app wants its current rowVersion (read just before). */
    public static void cancel(AppApi api, String id, String reason) {
        String rowVersion = ApiClient.ok(api.get("api/invoices/" + id), "GET /api/invoices/{id}").getString("rowVersion");
        ApiClient.ok(api.post("api/invoices/" + id + "/cancel", Map.of("reason", reason, "rowVersion", rowVersion)),
                "POST /api/invoices/{id}/cancel");
    }
}
