/** who took the request (undefined = nobody) and every refusal in the app's own words, one per login */
export interface Taker {
  login?: string;
  said: string[];
}

/**
 * The app takes ONE overtime request per employee per day, for today only: the logins are tried in order and the
 * first one the app takes it from is used. send throws only when the login cannot sign in on the phone.
 */
export async function firstTaker(logins: string[], send: (login: string) => Promise<{ ok: boolean; message: string }>): Promise<Taker> {
  const said: string[] = [];
  for (const login of logins.filter((l) => l.trim() !== '')) {
    try {
      const sent = await send(login);
      if (sent.ok) return { login, said };
      said.push(`${login}: ${sent.message || 'refused without a reason'}`);
    } catch (e) { // Test 8094 run 578: a login whose phone sign-in is refused - say which one, try the next
      said.push(`${login}: could not sign in on the phone (${e instanceof Error ? e.message : String(e)})`);
    }
  }
  return { said };
}
