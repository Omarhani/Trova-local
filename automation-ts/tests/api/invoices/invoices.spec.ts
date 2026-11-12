import { trovaTest as test } from '../../../src/run/trovaTest';
import { AppApi } from '../../../src/api/appApi';
import { invoiceKind } from '../../../src/api/records/invoiceKind';
import { InvoiceApi } from '../../../src/api/services/invoiceApi';
import { param } from '../../../src/run/blockParams';
import { runLogin } from '../../../src/run/credentials';
import { cleanUpRun } from '../../../src/records/cleanUpByIds';
import { once } from '../../../src/records/recordKind';

/** Clean-up of the Invoices suite (InvoicesApiTests): cancels by id the invoices this run made (the app has no delete), each read back Cancelled. */
test('cleanUpInvoicesProgrammatically', async () => {
  const login = runLogin(param('signedInAs', 'Admin'));
  await cleanUpRun([invoiceKind(once(async () => new InvoiceApi(await AppApi.signedInAs(login, 'web'))))]);
});
