#!/usr/bin/env node
import { Command } from "commander";

export const program = new Command();

program
  .name("audit")
  .description("AgentAudit: agent-readiness checks and order classification for Shopify stores")
  .version("0.1.0");

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
