import { estimateEconomics } from "./economics.js";
import { money, pct } from "./html.js";
import { monthlyVamp } from "./vampMonthly.js";
import type { ReportData } from "./types.js";

export type Finding = { severity: "critical" | "warning" | "info"; sentence: string };

const MIN_AGENT_DISPUTES = 5;

export function draftFindings(data: ReportData): Finding[] {
  const lead: Finding[] = [];
  const rest: Finding[] = [];
  const { readiness, classify, manualRuns } = data;

  // Lead with money when we have order data.
  if (classify) {
    const econ = estimateEconomics({ classify, readiness, manualRuns });
    lead.push({
      severity: "info",
      sentence: `Agent-attributed orders represent ${money(econ.capturedAgentAnnualLow)}–${money(econ.capturedAgentAnnualHigh)} of annualized revenue (measured from your own orders).`,
    });
    if (econ.hasForwardRisk) {
      lead.push({
        severity: "critical",
        sentence: `With the checkout blockers found here, an estimated ${money(econ.forwardAtRiskAnnualLow)}–${money(econ.forwardAtRiskAnnualHigh)}/yr of agent demand is at risk as the channel grows (scenario, not a measurement).`,
      });
    }
    const mv = monthlyVamp(classify.monthlyTrend, classify.vamp.config);
    if (mv.worstQualifying) {
      const w = mv.worstQualifying;
      lead.push({
        severity: w.band === "ok" ? "info" : "critical",
        sentence: `Worst qualifying month for disputes was ${w.month}: ${(w.ratio! * 100).toFixed(2)}% (${w.disputes}/${w.orders}), ${w.band === "ok" ? "within" : w.band === "above_standard" ? "above" : "well above"} Visa's monitoring thresholds.`,
      });
    }
    const agentDisputes =
      classify.byClass.high_confidence_agent.disputes + classify.byClass.heuristic_agent.disputes;
    if (agentDisputes >= MIN_AGENT_DISPUTES && classify.agentVsHuman.delta > 0) {
      rest.push({
        severity: "warning",
        sentence: `Agent-attributed orders dispute at ${pct(classify.agentVsHuman.agentDisputeRate, 2)} vs ${pct(classify.agentVsHuman.humanDisputeRate, 2)} for human orders.`,
      });
    }
    const trend = classify.monthlyTrend;
    if (trend.length >= 2) {
      const first = trend[0]!;
      const last = trend[trend.length - 1]!;
      if (last.agentOrderShare > first.agentOrderShare) {
        rest.push({
          severity: "info",
          sentence: `Agent order share rose from ${pct(first.agentOrderShare)} (${first.month}) to ${pct(last.agentOrderShare)} (${last.month}) over the window.`,
        });
      }
    }
  }

  // Readiness findings (always present).
  const blocked = readiness.robots.filter((r) => !r.allowed);
  if (blocked.length > 0) {
    lead.push({
      severity: "critical",
      sentence: `${blocked.length} of ${readiness.robots.length} agent user-agents are blocked by robots.txt (${blocked.map((b) => b.agent).join(", ")}).`,
    });
  } else {
    rest.push({ severity: "info", sentence: `All ${readiness.robots.length} agent user-agents are allowed by robots.txt.` });
  }

  const probeRan = readiness.checkout.productUrl !== null;
  if (probeRan && !readiness.checkout.reachedCheckout) {
    const why = readiness.checkout.blockers.map((b) => `${b.kind.replace(/_/g, " ")} at ${b.stage.replace(/_/g, " ")}`).join(", ");
    lead.push({ severity: "critical", sentence: `The automated probe could not reach checkout${why ? ` (${why})` : ""}.` });
  } else if (probeRan) {
    rest.push({ severity: "info", sentence: `The automated probe reached the checkout information page.` });
  }

  if (!readiness.feeds.productsJson.pass) rest.push({ severity: "warning", sentence: "The /products.json catalog feed is disabled or inaccessible to agents." });
  if (!readiness.feeds.sitemap.pass) rest.push({ severity: "warning", sentence: "The sitemap is missing or unreadable, limiting product discovery." });
  if (!readiness.feeds.llmsTxt.pass) rest.push({ severity: "info", sentence: "No llms.txt is published — an emerging convention that guides agents through the catalog." });

  const pages = readiness.productPages;
  const gaps = pages.filter((p) => p.problems.length > 0);
  if (pages.length > 0 && gaps.length > 0) {
    const seen = [...new Set(gaps.flatMap((p) => p.problems))].slice(0, 4);
    rest.push({ severity: "warning", sentence: `${gaps.length} of ${pages.length} sampled product pages have structured-data gaps (${seen.join("; ")}).` });
  }

  for (const r of manualRuns) {
    if (r.outcome === "abandoned") {
      rest.push({ severity: "warning", sentence: `${agentName(r.agent)} abandoned the purchase at the ${r.failure_stage?.replace(/_/g, " ")} step.` });
    }
  }

  return [...lead, ...rest];
}

function agentName(agent: string): string {
  const names: Record<string, string> = { chatgpt: "ChatGPT", perplexity: "Perplexity", claude: "Claude" };
  return names[agent] ?? agent;
}
