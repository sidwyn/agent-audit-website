import type { ClassifyOutput, ManualRun, ReadinessReport } from "@agentaudit/audit";

export type StoreMeta = {
  name: string;
  domain: string;
  gmvBand: string;
  contact: string;
};

export type ReportData = {
  meta: StoreMeta;
  readiness: ReadinessReport;
  // Order classification + manual runs require merchant data. Omitted for
  // readiness-only audits (e.g. non-Shopify stores or the cohort run), which
  // render the discovery/transaction half without the economics half.
  classify?: ClassifyOutput;
  manualRuns: ManualRun[];
  generatedAt: string;
};
