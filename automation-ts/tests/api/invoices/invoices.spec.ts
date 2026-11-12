import { trovaTest as test } from '../../../src/run/trovaTest';
import { AppApi } from '../../../src/api/appApi';
import { InvoiceApi, MADE_INVOICES } from '../../../src/api/services/invoiceApi';
import { param } from '../../../src/run/blockParams';
import { runLogin } from '../../../src/run/credentials';
import { runRecords } from '../../../src/run/runRecords';
import { checkEquals } from '../../../src/report/checks';

/** Clean-up of the Invoices suite (InvoicesApiTests): cancels the invoices this run made (the app has no delete for an invoice). */
test('cleanUpInvoicesProgrammatically', async () => {
  const ids = runRecords.newestFirst(MADE_INVOICES);
  test.skip(ids.length === 0, 'Nothing was kept by this run - nothing to cancel');
  const invoices = new InvoiceApi(await AppApi.signedInAs(runLogin(param('signedInAs', 'Admin')), 'web'));
  for (const id of ids) {
    await invoices.cancel(id, 'Automation clean-up');
    checkEquals(`Clean-up · invoice ${id} is cancelled`, await invoices.status(id), 'Cancelled');
    runRecords.forget(MADE_INVOICES, id);
  }
});
