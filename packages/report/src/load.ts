import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z, ZodError } from "zod";
import { manualRunsFileSchema, type ClassifyOutput, type ManualRun, type ReadinessReport } from "@agentaudit/audit";
import type { ReportData, StoreMeta } from "./types.js";

const checkResult = z.object({ pass: z.boolean(), status: z.number().nullable(), notes: z.string() });

const readinessSchema = z.object({
  store: z.string(),
  generatedAt: z.string(),
  robots: z.array(
    z.object({ agent: z.string(), allowed: z.boolean(), matchedGroup: z.string(), matchedRule: z.string().nullable() }),
  ),
  feeds: z.object({
    productsJson: checkResult,
    sitemap: checkResult.extend({ productUrlCount: z.number() }),
    llmsTxt: checkResult,
  }),
  productPages: z.array(
    z.object({
      url: z.string(),
      jsonLd: z.object({
        found: z.boolean(),
        price: z.boolean(),
        priceCurrency: z.boolean(),
        availability: z.boolean(),
        skuOrGtin: z.boolean(),
        image: z.boolean(),
      }),
      og: z.object({ title: z.boolean(), image: z.boolean() }),
      canonical: z.string().nullable(),
      problems: z.array(z.string()),
    }),
  ),
  checkout: z.object({
    productUrl: z.string().nullable(),
    reachedCart: z.boolean(),
    reachedCheckout: z.boolean(),
    blockers: z.array(
      z.object({
        stage: z.enum(["product_page", "variant", "cart", "checkout"]),
        kind: z.enum(["popup", "geo_gate", "login_wall", "captcha", "password_page", "js_error", "not_found", "timeout"]),
        detail: z.string(),
      }),
    ),
    jsErrors: z.array(z.string()),
    timeToCheckoutMs: z.number().nullable(),
    screenshots: z.array(z.string()),
  }),
});

const classSummary = z.object({
  orders: z.number(),
  orderShare: z.number(),
  gmv: z.number(),
  gmvShare: z.number(),
  aov: z.number(),
  disputes: z.number(),
  disputeRate: z.number(),
  refunds: z.number(),
  refundRate: z.number(),
});

const classifySchema = z.object({
  store: z.string(),
  generatedAt: z.string(),
  windowDays: z.number(),
  totals: z.object({ orders: z.number(), gmv: z.number(), disputes: z.number(), disputeRate: z.number() }),
  byClass: z.object({
    confirmed_channel: classSummary,
    high_confidence_agent: classSummary,
    heuristic_agent: classSummary,
    human: classSummary,
  }),
  distinctSources: z.array(
    z.object({ sourceName: z.string(), appId: z.string().nullable(), orders: z.number(), flaggedAssistant: z.boolean() }),
  ),
  agentVsHuman: z.object({
    agentOrders: z.number(),
    agentGmv: z.number(),
    humanGmv: z.number(),
    agentAov: z.number(),
    humanAov: z.number(),
    agentDisputeRate: z.number(),
    humanDisputeRate: z.number(),
    delta: z.number(),
  }),
  monthlyTrend: z.array(
    z.object({
      month: z.string(),
      orders: z.number(),
      agentOrders: z.number(),
      agentOrderShare: z.number(),
      gmv: z.number(),
      agentGmv: z.number(),
      agentGmvShare: z.number(),
      disputes: z.number(),
    }),
  ),
  disputeDollars: z.object({
    total: z.number(),
    counted: z.number(),
    coverage: z.number(),
    agentSide: z.number(),
    humanSide: z.number(),
  }),
  vamp: z.object({
    config: z.object({ aboveStandard: z.number(), excessive: z.number() }),
    combinedRatio: z.number(),
    band: z.enum(["ok", "above_standard", "excessive"]),
    headroomToNextBand: z.number().nullable(),
  }),
});

const metaSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  gmvBand: z.string().min(1),
  contact: z.string().min(1),
});

async function loadAndValidate<S extends z.ZodTypeAny>(
  file: string,
  schema: S,
  yaml = false,
): Promise<z.output<S>> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    throw new Error(`missing input file: ${file}`);
  }
  try {
    const parsed: unknown = yaml ? parseYaml(raw) : JSON.parse(raw);
    return schema.parse(parsed) as z.output<S>;
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`${file} failed validation: ${issues}`);
    }
    throw new Error(`${file} is not valid ${yaml ? "yaml" : "json"}`);
  }
}

export async function loadReportData(args: {
  dataDir: string;
  metaPath: string;
  generatedAt?: string;
}): Promise<ReportData> {
  const readiness = (await loadAndValidate(
    path.join(args.dataDir, "readiness.json"),
    readinessSchema,
  )) as ReadinessReport;
  const classify = (await loadAndValidate(
    path.join(args.dataDir, "classify.json"),
    classifySchema,
  )) as ClassifyOutput;
  const manual = await loadAndValidate(
    path.join(args.dataDir, "manual-runs.yaml"),
    manualRunsFileSchema,
    true,
  );
  const meta: StoreMeta = await loadAndValidate(args.metaPath, metaSchema);
  const manualRuns: ManualRun[] = manual.runs;
  return {
    meta,
    readiness,
    classify,
    manualRuns,
    generatedAt: args.generatedAt ?? new Date().toISOString(),
  };
}
