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
  classify: ClassifyOutput;
  manualRuns: ManualRun[];
  generatedAt: string;
};
