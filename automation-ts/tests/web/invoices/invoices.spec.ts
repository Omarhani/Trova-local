import { autoValue, invoiceNumberOf, moneyTotal } from '../../../src/data/invoiceValues';
import { AppApi } from '../../../src/api/appApi';
import { InvoiceApi, MADE_INVOICES } from '../../../src/api/services/invoiceApi';
import { param } from '../../../src/run/blockParams';
import { runLogin } from '../../../src/run/credentials';
import { runRecords } from '../../../src/run/runRecords';
import { checkContains, checkFalse, checkTrue } from '../../../src/report/checks';
import { refusedPage } from '../../../src/web/pageFacts';
import { InvoicesPage } from '../../../src/web/pages/InvoicesPage';
import { webTest as test } from '../../../src/web/webTest';

/** Invoices - the TS twin of tests.web.invoices.InvoicesTests: a new invoice made on the Invoices page; the clean-up cancels it by API. */

/** passes only when the app really opened signed in (the page fixture signs in once and refuses a sign-in page) */
test('logInProgrammatically', async ({ page }) => {
  checkFalse('Sign-in · the app opened signed in', refusedPage(page.url()));
});

test('testAdminCreatesAnInvoice', async ({ page }) => {
  const login = runLogin(param('signedInAs', 'Admin'));
  const quantity = param('invoice_quantity', '2');
  const unitPrice = param('invoice_unit_price', '75');
  const expectedTotal = moneyTotal(quantity, unitPrice);
  const invoices = new InvoicesPage(page);

  await invoices.openInvoices();
  await invoices.clickNewInvoice();
  await invoices.chooseCustomer(param('invoice_customer', 'WALK-IN'));
  await invoices.enterFreeTextItem(autoValue(param('invoice_item', 'auto'), 'AUTO-INV item'), quantity, unitPrice);
  await invoices.enterNotes(autoValue(param('invoice_notes', 'auto'), 'AUTO-INV'));
  checkContains('New invoice · final total', await invoices.finalTotalShows(expectedTotal), expectedTotal);
  await invoices.clickSave();

  const toast = await invoices.createdToastText();
  const number = invoiceNumberOf(toast);
  if (number !== '') { // kept at once for the clean-up
    const id = await new InvoiceApi(await AppApi.signedInAs(login, 'web')).idOf(number);
    if (id !== undefined) runRecords.keep(MADE_INVOICES, id);
  }
  checkContains('New invoice · toast amount', toast, `بمبلغ ${expectedTotal}`);
  checkFalse('New invoice · toast has the invoice number', number === '');
  checkTrue('New invoice · form closes', await invoices.formClosed());
  const row = await invoices.rowText(number);
  checkContains('New invoice · row total', row, expectedTotal);
  checkContains('New invoice · row status', row, 'بانتظار السداد');
});
