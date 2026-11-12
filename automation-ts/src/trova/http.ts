/** One HTTP call as the framework's API code makes it - an edge that unit tests replace with a fake. */
export interface HttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface HttpAnswer {
  status: number;
  text: string;
}

export type HttpSend = (request: HttpRequest) => Promise<HttpAnswer>;


/** the answer's JSON; text that is not JSON comes back as the text itself */
export function json(answer: HttpAnswer): unknown {
  if (!answer.text.trim()) return {};
  try {
    return JSON.parse(answer.text) as unknown;
  } catch {
    return answer.text;
  }
}
