/**
 * Narrow slice of the global `fetch` contract used by the provider adapters,
 * extracted (like `FetchFn` in `HttpFeedFetcher`) so request shaping stays
 * deterministic and a test could inject a double without touching the network.
 */
export type LlmHttpPost = (
  url: string,
  init: {
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<LlmHttpResponse>;

export interface LlmHttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/** Default `LlmHttpPost`, a POST over the runtime's global `fetch`. */
export const fetchLlmHttpPost: LlmHttpPost = (url, init) =>
  fetch(url, {method: 'POST', ...init}) as unknown as Promise<LlmHttpResponse>;

/**
 * Runs `post` with a per-call timeout (`LLM_TIMEOUT_MS`). Mirrors the
 * AbortController guard in `HttpFeedFetcher` so a hung provider cannot stall the
 * worker indefinitely.
 */
export async function postWithTimeout(
  post: LlmHttpPost,
  url: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number,
): Promise<LlmHttpResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await post(url, {headers, body, signal: controller.signal});
  } finally {
    clearTimeout(timer);
  }
}
