import { RUN_STAMP } from '../run/runStamp';

/** "auto" = made fresh (start + the run's stamp), "{stamp}" = this run's stamp, anything else as it is */
export function autoValue(value: string, start: string, stamp: string = RUN_STAMP): string {
  return value.toLowerCase() === 'auto' ? `${start} ${stamp}` : value.split('{stamp}').join(stamp);
}

/** quantity x unit price as the app shows money: two decimals, thousands commas ("1,510.00") */
export function moneyTotal(quantity: string, unitPrice: string): string {
  const total = Math.round(Number(quantity) * Number(unitPrice) * 100) / 100;
  return total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** the invoice number in the created message ("رقم 2026056 بمبلغ 150.00 EGP" = 2026056); "" when it has none */
export function invoiceNumberOf(message: string): string {
  return /رقم\s+(\d+)/.exec(message)?.[1] ?? '';
}
