export const AGENT_UA_TOKENS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "Google-Extended",
  "Amazonbot",
  "Applebot-Extended",
  "meta-externalagent",
  // "Bytespider", // ByteDance/TikTok — disabled for now (re-enable to restore)
] as const;

export type AgentUaToken = (typeof AGENT_UA_TOKENS)[number];

export const ASSISTANT_REFERRER_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "claude.ai",
  "gemini.google.com",
  "copilot.microsoft.com",
] as const;

export const ASSISTANT_UTM_SOURCES = [
  ...ASSISTANT_REFERRER_HOSTS,
  "chatgpt",
  "openai",
  "perplexity",
  "claude",
  "anthropic",
  "gemini",
  "copilot",
] as const;

export const HEADLESS_UA_MARKERS = [
  "headlesschrome",
  "phantomjs",
  "puppeteer",
  "playwright",
  "selenium",
  "python-requests",
  "python-httpx",
  "node-fetch",
  "axios/",
  "go-http-client",
  "curl/",
  "wget/",
  "okhttp",
] as const;

const ASSISTANT_SOURCE_HINTS = [
  "chatgpt",
  "openai",
  "perplexity",
  "claude",
  "anthropic",
  "gemini",
  "copilot",
];

export function matchesAgentUa(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const low = ua.toLowerCase();
  return AGENT_UA_TOKENS.find((t) => low.includes(t.toLowerCase())) ?? null;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url, "https://placeholder.invalid").hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isAssistantReferrer(url: string | null | undefined): boolean {
  if (!url) return false;
  const host = hostOf(url);
  if (!host) return false;
  return ASSISTANT_REFERRER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

export function hasAssistantUtmSource(landingSite: string | null | undefined): boolean {
  if (!landingSite) return false;
  try {
    const u = new URL(landingSite, "https://placeholder.invalid");
    const src = u.searchParams.get("utm_source")?.toLowerCase();
    return !!src && ASSISTANT_UTM_SOURCES.some((s) => src === s.toLowerCase());
  } catch {
    return false;
  }
}

export function hasHeadlessMarker(ua: string | null | undefined): boolean {
  if (!ua) return false;
  const low = ua.toLowerCase();
  return HEADLESS_UA_MARKERS.some((m) => low.includes(m));
}

export function isAssistantSourceName(sourceName: string): boolean {
  const low = sourceName.toLowerCase();
  return ASSISTANT_SOURCE_HINTS.some((h) => low.includes(h));
}
