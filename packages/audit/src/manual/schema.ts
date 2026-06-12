import { z } from "zod";

export const manualRunSchema = z
  .object({
    agent: z.enum(["chatgpt", "perplexity", "claude"]),
    task: z.string().min(1),
    steps: z.array(z.string().min(1)).min(1),
    outcome: z.enum(["success", "abandoned"]),
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
