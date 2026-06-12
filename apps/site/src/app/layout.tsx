import type { Metadata } from "next";
import { loadLandingCopy } from "../lib/marketing";
import { parseBlocks, stripBold } from "../lib/markdown";
import { VisitPing } from "../components/VisitPing";
import "./globals.css";

const copy = loadLandingCopy();
const heroBlocks = parseBlocks(copy.hero);
const headline = heroBlocks[0]?.type === "p" ? stripBold(heroBlocks[0].text) : "AgentAudit";
const sub = heroBlocks[1]?.type === "p" ? heroBlocks[1].text : "";

export const metadata: Metadata = {
  title: `AgentAudit — ${headline}`,
  description: sub,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <VisitPing />
      </body>
    </html>
  );
}
