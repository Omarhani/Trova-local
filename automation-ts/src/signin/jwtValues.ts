const JWT = /eyJ[A-Za-z0-9_-]{4,}\.(eyJ[A-Za-z0-9_-]{4,})\.[A-Za-z0-9_-]*/g;

/** a token found in a text and when it ends (epoch ms, 0 = it says no end) - read here only, never printed */
export interface FoundToken {
  token: string;
  endsAt: number;
}

/** every token in a text (a stored value, JSON-quoted or not) with its "exp" */
export function tokensIn(text: string): FoundToken[] {
  return [...text.matchAll(JWT)].map((m) => ({ token: m[0], endsAt: expOf(m[1]) }));
}

function expOf(payload: string): number {
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    return typeof claims.exp === 'number' ? claims.exp * 1000 : 0;
  } catch {
    return 0; // not a token after all
  }
}
