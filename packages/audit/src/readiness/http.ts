export type Fetcher = (url: string) => Promise<Response>;

export const AUDIT_USER_AGENT =
  "AgentAuditBot/0.1 (+https://agentaudit.site; store readiness check)";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Serializes all requests through one queue at >= intervalMs spacing (spec: 1 req/sec).
export function makeThrottledFetch(opts: {
  fetchImpl?: typeof fetch;
  intervalMs?: number;
  timeoutMs?: number;
} = {}): Fetcher {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const intervalMs = opts.intervalMs ?? 1000;
  const timeoutMs = opts.timeoutMs ?? 15000;

  let queue: Promise<unknown> = Promise.resolve();
  let lastStartedAt = 0;

  return (url: string): Promise<Response> => {
    const result = queue.then(async () => {
      const wait = lastStartedAt + intervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      lastStartedAt = Date.now();
      return fetchImpl(url, {
        headers: { "User-Agent": AUDIT_USER_AGENT, Accept: "*/*" },
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      });
    });
    queue = result.catch(() => undefined);
    return result;
  };
}
