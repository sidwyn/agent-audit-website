import { existsSync, readFileSync } from "node:fs";

// Distribution of the 50-store cohort, written once by the batch run. Readiness
// only (public-surface data) — no peer order/dispute data is ever needed.
export type CohortStats = {
  generatedAt: string;
  n: number;
  source: string;
  scores: number[]; // total readiness scores across the cohort
  checkPassRate: {
    robotsAllAllowed: number;
    productsJson: number;
    sitemap: number;
    llmsTxt: number;
    structuredDataClean: number;
    reachedCheckout: number;
  };
  blockedAgentRate: Record<string, number>; // per UA token: fraction of cohort blocking it
};

export type Benchmark = {
  n: number;
  source: string;
  score: number;
  percentile: number; // 0-100, fraction of cohort scoring <= this store
  median: number;
  storesBetter: number;
};

// Percentile of `value` within `values` (fraction scoring at or below), 0-100.
export function percentile(value: number, values: number[]): number {
  if (values.length === 0) return 0;
  const atOrBelow = values.filter((v) => v <= value).length;
  return Math.round((atOrBelow / values.length) * 100);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export function loadCohort(path: string): CohortStats | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as CohortStats;
  } catch {
    return null;
  }
}

export function benchmarkScore(score: number, cohort: CohortStats): Benchmark {
  return {
    n: cohort.n,
    source: cohort.source,
    score,
    percentile: percentile(score, cohort.scores),
    median: median(cohort.scores),
    storesBetter: cohort.scores.filter((s) => s > score).length,
  };
}
