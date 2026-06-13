import type { ClassifyOutput, ManualRun, ReadinessReport } from "@agentaudit/audit";

export type EconomyAssumptions = {
  chargebackFeeLow: number;
  chargebackFeeHigh: number;
  listPrice: number;
};

export const DEFAULT_ASSUMPTIONS: EconomyAssumptions = {
  // Per-dispute handling cost (network + processor fees, excludes lost goods).
  // Range is an industry-typical assumption, shown to the reader, not measured.
  chargebackFeeLow: 15,
  chargebackFeeHigh: 25,
  listPrice: 499,
};

export type Economics = {
  windowDays: number;
  annualizeFactor: number;
  // measured: agent-attributed revenue that already converted
  capturedAgentWindowLow: number;
  capturedAgentWindowHigh: number;
  capturedAgentAnnualLow: number;
  capturedAgentAnnualHigh: number;
  // measured + assumed fee: dispute cost
  disputedWindow: number;
  disputedCoverage: number;
  disputedAnnual: number;
  disputeFeeAnnualLow: number;
  disputeFeeAnnualHigh: number;
  agentSideDisputedShare: number;
  // scenario (forward-looking), only when a transaction blocker exists
  transactionFailureRate: number;
  forwardAtRiskAnnualLow: number;
  forwardAtRiskAnnualHigh: number;
  hasForwardRisk: boolean;
  assumptions: string[];
};

function transactionFailureRate(readiness: ReadinessReport, manualRuns: ManualRun[]): {
  rate: number;
  tested: number;
  failed: number;
} {
  let tested = 1; // the automated probe always counts as one tested path
  let failed = readiness.checkout.reachedCheckout ? 0 : 1;
  for (const r of manualRuns) {
    tested += 1;
    if (r.outcome === "abandoned") failed += 1;
  }
  return { rate: tested === 0 ? 0 : failed / tested, tested, failed };
}

export function estimateEconomics(
  data: { classify: ClassifyOutput; readiness: ReadinessReport; manualRuns: ManualRun[] },
  assumptions: EconomyAssumptions = DEFAULT_ASSUMPTIONS,
): Economics {
  const { classify, readiness, manualRuns } = data;
  const windowDays = classify.windowDays || 90;
  const factor = 365 / windowDays;

  const capturedWindowLow =
    classify.byClass.confirmed_channel.gmv + classify.byClass.high_confidence_agent.gmv;
  const capturedWindowHigh = capturedWindowLow + classify.byClass.heuristic_agent.gmv;

  const disputedWindow = classify.disputeDollars.total;
  const disputeFeeAnnualLow = classify.totals.disputes * assumptions.chargebackFeeLow * factor;
  const disputeFeeAnnualHigh = classify.totals.disputes * assumptions.chargebackFeeHigh * factor;
  const agentSideDisputedShare =
    classify.disputeDollars.total === 0 ? 0 : classify.disputeDollars.agentSide / classify.disputeDollars.total;

  const fail = transactionFailureRate(readiness, manualRuns);
  const capturedAnnualLow = capturedWindowLow * factor;
  const capturedAnnualHigh = capturedWindowHigh * factor;
  const forwardLow = capturedAnnualLow * fail.rate;
  const forwardHigh = capturedAnnualHigh * fail.rate;

  const assumptionLines = [
    `Annualized figures multiply the ${windowDays}-day window by ${factor.toFixed(2)} (365/${windowDays}); they assume the window is representative.`,
    `Captured agent revenue is the store's OWN measured GMV for agent-attributed orders. Floor = confirmed + high-confidence tiers; ceiling adds the heuristic tier, which may include datacenter/VPN traffic that is not a true agent.`,
    `Dispute cost uses an assumed per-dispute handling fee of $${assumptions.chargebackFeeLow}-$${assumptions.chargebackFeeHigh} (industry-typical; not measured) plus the merchant-reported disputed amount, which covered ${(classify.disputeDollars.coverage * 100).toFixed(0)}% of disputes.`,
  ];
  if (fail.rate > 0) {
    assumptionLines.push(
      `Forward exposure is a SCENARIO, not a measurement: ${fail.failed} of ${fail.tested} tested agent paths failed to reach checkout (rate ${(fail.rate * 100).toFixed(0)}%). It estimates demand at risk as the agent channel grows; it is NOT a claim that already-captured revenue is lost.`,
    );
  }

  return {
    windowDays,
    annualizeFactor: factor,
    capturedAgentWindowLow: capturedWindowLow,
    capturedAgentWindowHigh: capturedWindowHigh,
    capturedAgentAnnualLow: capturedAnnualLow,
    capturedAgentAnnualHigh: capturedAnnualHigh,
    disputedWindow,
    disputedCoverage: classify.disputeDollars.coverage,
    disputedAnnual: disputedWindow * factor,
    disputeFeeAnnualLow,
    disputeFeeAnnualHigh,
    agentSideDisputedShare,
    transactionFailureRate: fail.rate,
    forwardAtRiskAnnualLow: forwardLow,
    forwardAtRiskAnnualHigh: forwardHigh,
    hasForwardRisk: fail.rate > 0 && capturedWindowHigh > 0,
    assumptions: assumptionLines,
  };
}
