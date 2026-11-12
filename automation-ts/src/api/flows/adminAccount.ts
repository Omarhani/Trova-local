import { AppApi, ok } from '../appApi';
import { accountCode } from './employeeValues';

/** the admin's account id: Account/GetAccountIdByCode with the admin's account code, on the admin's API (Java AvailoApi.getAccountId) */
export async function adminAccountId(admin: AppApi): Promise<string> {
  const call = 'Account/GetAccountIdByCode';
  const answer = ok(await admin.post(admin.underRoot('api', call), { Data: { code: accountCode() } }), call);
  const id = (answer as { Data?: { ID?: unknown } } | null)?.Data?.ID;
  if (id === undefined || id === null || String(id) === '') throw new Error(`The app knows no account with the admin's account code`);
  return String(id);
}

/** the admin's account id asked once per service, kept for its later calls */
export function accountIdOf(admin: AppApi): () => Promise<string> {
  let id: Promise<string> | undefined;
  return () => (id ??= adminAccountId(admin));
}
