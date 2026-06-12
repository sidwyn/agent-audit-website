import { AGENT_UA_TOKENS } from "../classify/agents.js";
import type { Fetcher } from "./http.js";
import type { RobotsVerdict } from "./types.js";

export type RobotsRule = { type: "allow" | "disallow"; path: string };
export type RobotsGroup = { agents: string[]; rules: RobotsRule[] };

export function parseRobots(txt: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastLineWasAgent = false;

  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const field = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();

    if (field === "user-agent") {
      if (!lastLineWasAgent || !current) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastLineWasAgent = true;
    } else if (field === "allow" || field === "disallow") {
      lastLineWasAgent = false;
      if (current) current.rules.push({ type: field, path: value });
    } else {
      lastLineWasAgent = false;
    }
  }
  return groups;
}

export function evaluateAgentAccess(
  groups: RobotsGroup[],
  agentToken: string,
  path = "/",
): RobotsVerdict {
  const token = agentToken.toLowerCase();
  const exact = groups.filter((g) => g.agents.includes(token));
  const wildcard = groups.filter((g) => g.agents.includes("*"));
  const applicable = exact.length > 0 ? exact : wildcard;
  const matchedGroup = exact.length > 0 ? agentToken : wildcard.length > 0 ? "*" : "(none)";

  if (applicable.length === 0) {
    return { agent: agentToken, allowed: true, matchedGroup, matchedRule: null };
  }

  // Longest-path-match wins; allow wins ties. Empty disallow value = allow all.
  let best: { rule: RobotsRule; specificity: number } | null = null;
  for (const group of applicable) {
    for (const rule of group.rules) {
      if (rule.type === "disallow" && rule.path === "") continue;
      if (rule.path === "" || !path.startsWith(rule.path)) continue;
      const specificity = rule.path.length;
      if (
        !best ||
        specificity > best.specificity ||
        (specificity === best.specificity && rule.type === "allow" && best.rule.type === "disallow")
      ) {
        best = { rule, specificity };
      }
    }
  }

  if (!best) {
    return { agent: agentToken, allowed: true, matchedGroup, matchedRule: null };
  }
  return {
    agent: agentToken,
    allowed: best.rule.type === "allow",
    matchedGroup,
    matchedRule: `${best.rule.type === "allow" ? "Allow" : "Disallow"}: ${best.rule.path}`,
  };
}

export async function auditRobots(
  baseUrl: string,
  fetcher: Fetcher,
  path = "/",
): Promise<RobotsVerdict[]> {
  let txt = "";
  try {
    const res = await fetcher(new URL("/robots.txt", baseUrl).toString());
    if (res.ok) txt = await res.text();
  } catch {
    // unreachable robots.txt behaves like an empty one: everything allowed
  }
  const groups = parseRobots(txt);
  return AGENT_UA_TOKENS.map((agent) => evaluateAgentAccess(groups, agent, path));
}
