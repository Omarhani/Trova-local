package tests.web.invoices;

import api.client.AppApi;
import api.services.InvoiceApi;
import base.BaseTests;
import org.testng.annotations.Optional;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;
import utils.RunIds;

import java.math.BigDecimal;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static utils.MethodHandlesWeb.*;

/** Invoices: a new invoice made on the Invoices page; the clean-up cancels it by API. */
public class InvoicesTests extends BaseTests {

    private static final String RUN = UUID.randomUUID().toString().replace("-", "").substring(0, 6);

    /** "auto" = made fresh, "{stamp}" = this run's stamp, anything else as it is */
    private static String fresh(String value, String auto) {
        return "auto".equalsIgnoreCase(value) ? auto + " " + RUN : value.replace("{stamp}", RUN);
    }

    @Parameters("signedInAs")
    @Test(groups = "Web")
    public void logInProgrammatically(@Optional("Admin") String signedInAs) {
        signInOnce(signedInAs);
    }

    @Parameters({"signedInAs", "invoice_customer", "invoice_item", "invoice_quantity", "invoice_unit_price", "invoice_notes"})
    @Test(groups = "Web")
    public void testAdminCreatesAnInvoice(@Optional("Admin") String login, @Optional("WALK-IN") String customer,
            @Optional("auto") String item, @Optional("2") String quantity, @Optional("75") String unitPrice,
            @Optional("auto") String notes) {
        String description = fresh(item, "AUTO-INV item");
        String expectedTotal = String.format("%,.2f", new BigDecimal(quantity).multiply(new BigDecimal(unitPrice)));
        invoicesPage.openInvoices();
        invoicesPage.clickNewInvoice();
        invoicesPage.chooseCustomer(customer);
        invoicesPage.enterFreeTextItem(description, quantity, unitPrice);
        invoicesPage.enterNotes(fresh(notes, "AUTO-INV"));
        myAssertContains("New invoice · final total", invoicesPage.finalTotalShows(expectedTotal), expectedTotal);
        invoicesPage.clickSave();

        String toast = invoicesPage.createdToastText();
        Matcher m = Pattern.compile("رقم\\s+(\\d+)").matcher(toast);
        String number = m.find() ? m.group(1) : "";
        if (!number.isEmpty()) { // kept at once for the clean-up
            String id = InvoiceApi.idOf(AppApi.signedInAs(login), number);
            if (id != null) RunIds.keep(InvoiceApi.MADE_INVOICES, id);
        }
        myAssertContains("New invoice · toast amount", toast, "بمبلغ " + expectedTotal);
        myAssertFalse("New invoice · toast has the invoice number", number.isEmpty());
        myAssertTrue("New invoice · form closes", invoicesPage.formClosed());
        String row = invoicesPage.rowText(number);
        myAssertContains("New invoice · row total", row, expectedTotal);
        myAssertContains("New invoice · row status", row, "بانتظار السداد");
    }
}
