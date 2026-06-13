import type { ManualRun, ReadinessReport } from "@agentaudit/audit";

export type FunnelStage = {
  stage: string;
  label: string;
  failures: number;
  detail: string;
};

const STAGE_ORDER = ["discovery", "product_page", "variant", "cart", "checkout", "payment"] as const;
const STAGE_LABELS: Record<string, string> = {
  discovery: "Discovery (robots / feeds)",
  product_page: "Product page (read details)",
  variant: "Variant selection",
  cart: "Add to cart",
  checkout: "Reach checkout",
  payment: "Payment (out of scope)",
};

// Aggregates every "where agents die" signal into one ordered funnel: blocked
// crawlers (discovery), automated-probe blockers, manual abandonment stages, and
// product-page structured-data gaps. The top failing stage should drive the #1 fix.
export function buildFunnel(readiness: ReadinessReport, manualRuns: ManualRun[]): FunnelStage[] {
  const counts = new Map<string, number>(STAGE_ORDER.map((s) => [s, 0]));
  const details = new Map<string, string[]>(STAGE_ORDER.map((s) => [s, []]));
  const bump = (stage: string, n: number, why: string) => {
    counts.set(stage, (counts.get(stage) ?? 0) + n);
    if (why) details.get(stage)?.push(why);
  };

  const blockedAgents = readiness.robots.filter((r) => !r.allowed);
  if (blockedAgents.length > 0) {
    bump("discovery", blockedAgents.length, `${blockedAgents.length} agent UAs blocked by robots.txt`);
  }
  const pagesWithGaps = readiness.productPages.filter((p) => p.problems.length > 0).length;
  if (pagesWithGaps > 0) {
    bump("product_page", pagesWithGaps, `${pagesWithGaps} product pages with structured-data gaps`);
  }
  for (const b of readiness.checkout.blockers) {
    bump(b.stage, 1, `probe: ${b.kind.replace(/_/g, " ")}`);
  }
  for (const r of manualRuns) {
    if (r.outcome === "abandoned" && r.failure_stage) {
      bump(r.failure_stage, 1, `${r.agent} abandoned`);
    }
  }

  return STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage]!,
    failures: counts.get(stage) ?? 0,
    detail: [...new Set(details.get(stage) ?? [])].join("; "),
  }));
}

export function topFailingStage(funnel: FunnelStage[]): FunnelStage | null {
  const withFailures = funnel.filter((f) => f.failures > 0);
  if (withFailures.length === 0) return null;
  return withFailures.reduce((top, f) => (f.failures > top.failures ? f : top));
}
