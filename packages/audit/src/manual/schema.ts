import { z } from "zod";

// The full shopping funnel an agent walks, finer-grained than the old 5-column
// strip. Each live run reports a per-stage status so the report can show exactly
// where an agent would succeed or stall.
export const FUNNEL_STAGES = [
  "homepage",
  "search",
  "collection",
  "product",
  "variant",
  "add_to_cart",
  "cart",
  "checkout_info",
  "shipping",
  "payment_boundary",
  "confirmation",
] as const;
export type FunnelStageName = (typeof FUNNEL_STAGES)[number];

export const stageStatusSchema = z.enum(["pass", "fail", "partial", "skipped", "na"]);

export const stageResultSchema = z.object({
  stage: z.enum(FUNNEL_STAGES),
  status: stageStatusSchema,
  note: z.string().optional(),
});

// Precise, forensic blocker taxonomy so "why did it stall" is specific, not just
// "abandoned". `other` is the escape hatch; `none` means no blocker hit.
export const BLOCKER_CODES = [
  "none",
  "captcha",
  "bot_protection",
  "cloudflare_challenge",
  "login_required",
  "address_validation",
  "phone_validation",
  "shipping_unavailable",
  "payment_required",
  "iframe_issue",
  "cross_domain_checkout",
  "disabled_button",
  "modal_obstruction",
  "cart_drawer_unparsed",
  "missing_required_field",
  "other",
] as const;
export type BlockerCode = (typeof BLOCKER_CODES)[number];
export const blockerCodeSchema = z.enum(BLOCKER_CODES);

// agent is free-form (lowercased) so any assistant works — chatgpt, perplexity,
// claude, gemini, copilot, rufus, codex, etc. The report's brand matrix maps the
// known consumer assistants; others still appear in the transaction layer.
export const manualRunSchema = z
  .object({
    agent: z
      .string()
      .min(1)
      .transform((s) => s.trim().toLowerCase()),
    // The specific model/version the assistant ran on (e.g. "GPT-5", "Gemini 2.5
    // Pro", "Claude Opus 4.8") — shop owners care which model could buy from them.
    model: z.string().min(1).optional(),
    task: z.string().min(1),
    steps: z.array(z.string().min(1)).min(1),
    outcome: z.enum(["success", "abandoned"]),
    // Seconds from opening the product (discovery) to the item being in the cart.
    secondsToCart: z.number().nonnegative().nullish(),
    // Per-stage funnel map for this run (empty for legacy one-line results).
    stages: z.array(stageResultSchema).default([]),
    // Which product this run shopped (so multi-product-type coverage is legible).
    productType: z.string().optional(),
    // Forensic blocker classification (taxonomy above).
    blockerCode: blockerCodeSchema.optional(),
    failure_stage: z
      .enum(["discovery", "product_page", "variant", "cart", "checkout", "payment"])
      .optional(),
    notes: z.string().optional(),
    screenshots: z.array(z.string()).default([]),
  })
  .superRefine((run, ctx) => {
    if (run.outcome === "abandoned" && !run.failure_stage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["failure_stage"],
        message: "failure_stage is required when outcome is abandoned",
      });
    }
  });

export const manualRunsFileSchema = z.object({
  store: z.string().min(1),
  runs: z.array(manualRunSchema).min(1),
});

export type ManualRun = z.infer<typeof manualRunSchema>;
export type ManualRunsFile = z.infer<typeof manualRunsFileSchema>;
