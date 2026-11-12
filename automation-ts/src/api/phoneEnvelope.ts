/** the headers the phone app sends with every call (no key of a login) - Java AvailoMobileApi */
export const PHONE_HEADERS: Readonly<Record<string, string>> = Object.freeze({ Language: '0', type: 'flutter' });

/** the envelope the phone app wraps every body in: {UserID, PageNumber, PageSize, TimeZoneOffset, RequstId, Data} */
export function phoneEnvelope(userId: string, data: unknown, requestId: string): Record<string, unknown> {
  return { UserID: userId, PageNumber: 1, PageSize: 10, TimeZoneOffset: -180, RequstId: requestId, Data: data };
}
