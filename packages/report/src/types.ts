import type { ClassifyOutput, ManualRun, ReadinessReport } from "@agentaudit/audit";

export type StoreMeta = {
  name: string;
  domain: string;
  gmvBand: string;
  contact: string;
};

// Per-store personalization for the scorecard header (data URIs so the PDF is
// self-contained): a homepage screenshot banner and the store's favicon/logo.
export type Branding = { screenshot?: string; logo?: string };

export type ReportData = {
  meta: StoreMeta;
  branding?: Branding;
  // per-agent step screenshots as data URIs (agent key -> ordered images),
  // resolved by the renderer from each run's screenshots[]; shown in the transaction layer.
  runScreenshots?: Record<string, string[]>;
  readiness: ReadinessReport;
  // Order classification + manual runs require merchant data. Omitted for
  // readiness-only audits (e.g. non-Shopify stores or the cohort run), which
  // render the discovery/transaction half without the economics half.
  classify?: ClassifyOutput;
  manualRuns: ManualRun[];
  generatedAt: string;
};
