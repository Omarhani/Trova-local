import { AppApi, ok } from '../appApi';

/** run records kind: the ids of the invoices this run made */
export const MADE_INVOICES = 'invoiceIds';

type Row = Record<string, unknown>;

/**
 * Invoices by API (web side) - the TS twin of api.services.InvoiceApi. An invoice cannot be deleted: the clean-up
 * cancels it, as the app's own Cancel does.
 */
export class InvoiceApi {
  constructor(private readonly api: AppApi) {}

  /** the id of the invoice with this exact number, read back from the list right after the save; undefined when not found */
  async idOf(number: string): Promise<string | undefined> {
    const answer = ok(await this.api.get(`api/invoices?pageNumber=1&pageSize=15&search=${encodeURIComponent(number)}`), 'GET /api/invoices') as { items?: Row[] };
    const row = (answer?.items ?? []).find((r) => String(r.number) === number);
    return row === undefined ? undefined : String(row.id);
  }

  /** the invoice's status: Pending, Paid, Cancelled ... */
  async status(id: string): Promise<string> {
    return String((await this.invoice(id)).status ?? '');
  }

  /** cancels the invoice; the app wants its current rowVersion (read just before) */
  async cancel(id: string, reason: string): Promise<void> {
    const rowVersion = String((await this.invoice(id)).rowVersion ?? '');
    ok(await this.api.post(`api/invoices/${id}/cancel`, { reason, rowVersion }), 'POST /api/invoices/{id}/cancel');
  }

  private async invoice(id: string): Promise<Row> {
    return (ok(await this.api.get(`api/invoices/${id}`), 'GET /api/invoices/{id}') ?? {}) as Row;
  }
}
