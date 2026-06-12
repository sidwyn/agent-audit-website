// Privacy-friendly visit counter stub: no cookies, no fingerprinting, no
// third-party script. POSTs a bare path to NEXT_PUBLIC_COUNTER_ENDPOINT if
// configured at build time; otherwise it is a no-op.
export function recordVisit(path: string): void {
  const endpoint = process.env.NEXT_PUBLIC_COUNTER_ENDPOINT;
  if (!endpoint) return;
  void fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
    keepalive: true,
  }).catch(() => undefined);
}
