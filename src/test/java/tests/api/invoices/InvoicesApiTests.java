package tests.api.invoices;

import api.client.AppApi;
import api.services.InvoiceApi;
import base.BaseApi;
import org.testng.SkipException;
import org.testng.annotations.Optional;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;
import utils.RunIds;

import java.util.List;

import static utils.MethodHandlesWeb.myAssertEquals;

/** Clean-up of the Invoices suite: cancels the invoices this run made (the app has no delete for an invoice). */
public class InvoicesApiTests extends BaseApi {

    @Parameters("signedInAs")
    @Test(alwaysRun = true)
    public void cleanUpInvoicesProgrammatically(@Optional("Admin") String login) {
        List<String> ids = RunIds.newestFirst(InvoiceApi.MADE_INVOICES);
        if (ids.isEmpty()) {
            throw new SkipException("Nothing was kept by this run - nothing to cancel");
        }
        AppApi api = AppApi.signedInAs(login);
        for (String id : ids) {
            InvoiceApi.cancel(api, id, "Automation clean-up");
            myAssertEquals("Clean-up · invoice " + id + " is cancelled", InvoiceApi.status(api, id), "Cancelled");
            RunIds.forget(InvoiceApi.MADE_INVOICES, id);
        }
    }
}
