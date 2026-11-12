import { Made, RecordKind, settled } from '../../records/recordKind';
import { InvoiceApi } from '../services/invoiceApi';
import { INVOICE } from './recordKeys';

const CANCELLED = 'Cancelled';

/** the invoices this run made: the app has no delete, so each is cancelled by id and read back Cancelled */
export function invoiceKind(api: () => Promise<InvoiceApi>): RecordKind {
  return {
    ...INVOICE,
    done: CANCELLED,
    delete: async (m: Made) => {
      const invoices = await api();
      return settled(() => invoices.cancel(m.id, 'Automation clean-up'));
    },
    isThere: async (m: Made) => (await (await api()).status(m.id)) !== CANCELLED,
  };
}
