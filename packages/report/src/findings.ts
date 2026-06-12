import type { ReportData } from "./types.js";

export type Finding = { severity: "critical" | "warning" | "info"; sentence: string };

const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;

export function draftFindings(data: ReportData): Finding[] {
  const findings: Finding[] = [];
  const { readiness, classify, manualRuns } = data;

  const blocked = readiness.robots.filter((r) => !r.allowed);
  if (blocked.length > 0) {
    findings.push({
      severity: "critical",
      sentence: `${blocked.length} of ${readiness.robots.length} agent user-agents are blocked by robots.txt (${blocked.map((b) => b.agent).join(", ")}).`,
    });
  } else {
    findings.push({
      severity: "info",
      sentence: `All ${readiness.robots.length} agent user-agents are allowed by robots.txt.`,
    });
  }

  if (!readiness.feeds.productsJson.pass) {
    findings.push({ severity: "warning", sentence: "The /products.json feed is disabled or inaccessible, so agents cannot read the catalog programmatically." });
  }
  if (!readiness.feeds.sitemap.pass) {
    findings.push({ severity: "warning", sentence: "The sitemap is missing or unreadable, which limits product discovery for crawlers and agents." });
  }
  if (!readiness.feeds.llmsTxt.pass) {
    findings.push({ severity: "info", sentence: "No llms.txt file is published; this is an emerging convention that gives agents a guided index of the store." });
  }

  const pages = readiness.productPages;
  if (pages.length > 0) {
    const withProblems = pages.filter((p) => p.problems.length > 0);
    if (withProblems.length > 0) {
      const gaps = [...new Set(withProblems.flatMap((p) => p.problems))].slice(0, 4);
      findings.push({
        severity: "warning",
        sentence: `${withProblems.length} of ${pages.length} sampled product pages have structured-data gaps (${gaps.join("; ")}).`,
      });
    } else {
      findings.push({ severity: "info", sentence: `All ${pages.length} sampled product pages carry complete Product/Offer structured data.` });
    }
  }

  if (readiness.checkout.reachedCheckout) {
    const secs = readiness.checkout.timeToCheckoutMs !== null ? ` in ${Math.round(readiness.checkout.timeToCheckoutMs / 1000)} seconds` : "";
    findings.push({ severity: "info", sentence: `The automated probe reached the checkout information page${secs}.` });
  } else {
    const why = readiness.checkout.blockers.map((b) => `${b.kind.replace(/_/g, " ")} at ${b.stage.replace(/_/g, " ")}`).join(", ");
    findings.push({
      severity: "critical",
      sentence: `No automated path reached checkout${why ? ` (${why})` : ""}.`,
    });
  }

  for (const run of manualRuns) {
    if (run.outcome === "abandoned") {
      findings.push({
        severity: "warning",
        sentence: `${agentName(run.agent)} abandoned the purchase at the ${run.failure_stage?.replace(/_/g, " ")} step.`,
      });
    }
  }
  const successes = manualRuns.filter((r) => r.outcome === "success");
  if (successes.length === manualRuns.length && manualRuns.length > 0) {
    findings.push({ severity: "info", sentence: `All ${manualRuns.length} live shopping agents completed the purchase task.` });
  }

  const agentOrderShare =
    classify.byClass.confirmed_channel.orderShare +
    classify.byClass.high_confidence_agent.orderShare +
    classify.byClass.heuristic_agent.orderShare;
  const agentGmvShare =
    classify.byClass.confirmed_channel.gmvShare +
    classify.byClass.high_confidence_agent.gmvShare +
    classify.byClass.heuristic_agent.gmvShare;
  findings.push({
    severity: "info",
    sentence: `Agent-attributed orders account for ${pct(agentOrderShare)} of orders and ${pct(agentGmvShare)} of GMV over the last ${classify.windowDays} days.`,
  });

  if (classify.agentVsHuman.delta > 0 && classify.agentVsHuman.agentOrders > 0) {
    findings.push({
      severity: "warning",
      sentence: `Agent-placed orders dispute at ${pct(classify.agentVsHuman.agentDisputeRate)} versus ${pct(classify.agentVsHuman.humanDisputeRate)} for human orders.`,
    });
  }

  if (classify.vamp.band === "ok") {
    findings.push({
      severity: "info",
      sentence: `The combined dispute ratio is ${pct(classify.vamp.combinedRatio, 2)}, below Visa's ${pct(classify.vamp.config.aboveStandard, 1)} monitoring threshold with ${pct(classify.vamp.headroomToNextBand ?? 0, 2)} of headroom.`,
    });
  } else {
    findings.push({
      severity: "critical",
      sentence: `The combined dispute ratio is ${pct(classify.vamp.combinedRatio, 2)}, ${classify.vamp.band === "excessive" ? "in Visa's excessive band" : `above Visa's ${pct(classify.vamp.config.aboveStandard, 1)} monitoring threshold`} under the April 2026 VAMP rules.`,
    });
  }

  return findings;
}

function agentName(agent: string): string {
  const names: Record<string, string> = { chatgpt: "ChatGPT", perplexity: "Perplexity", claude: "Claude" };
  return names[agent] ?? agent;
}
