import type { LandingCopy } from "../lib/marketing";
import { parseBlocks, parseFaq, stripBold } from "../lib/markdown";
import { Cta } from "./Cta";
import { Inline } from "./Inline";

type Env = { stripeUrl?: string; formEndpoint?: string };

export function Hero({ copy, env }: { copy: LandingCopy["hero"]; env: Env }) {
  const blocks = parseBlocks(copy);
  const headline = blocks[0]?.type === "p" ? stripBold(blocks[0].text) : "";
  const sub = blocks[1]?.type === "p" ? blocks[1].text : "";
  const cta = blocks.find((b) => b.type === "cta");
  const fine = blocks[3]?.type === "p" ? blocks[3].text : "";
  return (
    <section className="hero">
      <p className="brand">AgentAudit</p>
      <h1>{headline}</h1>
      <p className="sub">
        <Inline text={sub} />
      </p>
      {cta && <Cta label={cta.label} {...env} id="cta-top" />}
      <p className="fine">{fine}</p>
      <p className="sample-link">
        <a href="/sample-report.pdf" data-testid="sample-report-link">
          See a sample report (PDF) →
        </a>
      </p>
    </section>
  );
}

export function StatsBar({ copy }: { copy: LandingCopy["statsBar"] }) {
  const first = parseBlocks(copy)[0];
  const items = first?.type === "ul" ? first.items : [];
  return (
    <section className="stats" aria-label="Key stats">
      <ul>
        {items.map((item) => (
          <li key={item}>
            <Inline text={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WhatYouGet({ copy }: { copy: LandingCopy["whatYouGet"] }) {
  const blocks = parseBlocks(copy);
  const intro = blocks[0]?.type === "p" ? blocks[0].text : "";
  const list = blocks.find((b) => b.type === "ol");
  return (
    <section className="get" id="what-you-get">
      <h2>What you get</h2>
      <p className="intro">
        <Inline text={intro} />
      </p>
      <ol className="cards">
        {(list?.type === "ol" ? list.items : []).map((item) => (
          <li key={item}>
            <Inline text={item} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HowItWorks({ copy }: { copy: LandingCopy["howItWorks"] }) {
  const list = parseBlocks(copy).find((b) => b.type === "ol");
  return (
    <section className="how" id="how-it-works">
      <h2>How it works</h2>
      <ol className="steps">
        {(list?.type === "ol" ? list.items : []).map((item) => (
          <li key={item}>
            <Inline text={item} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Guarantee({ copy }: { copy: LandingCopy["guarantee"] }) {
  return (
    <section className="guarantee" id="guarantee">
      <h2>Guarantee</h2>
      <p>
        <Inline text={copy} />
      </p>
    </section>
  );
}

export function Faq({ copy }: { copy: LandingCopy["faq"] }) {
  const entries = parseFaq(copy);
  return (
    <section className="faq" id="faq">
      <h2>FAQ</h2>
      {entries.map((e) => (
        <details key={e.q}>
          <summary>{e.q}</summary>
          <p>{e.a}</p>
        </details>
      ))}
    </section>
  );
}

export function About({ copy }: { copy: LandingCopy["about"] }) {
  const blocks = parseBlocks(copy);
  return (
    <section className="about" id="about">
      <h2>About</h2>
      {blocks.map((b, i) =>
        b.type === "p" ? (
          <p key={i}>
            <Inline text={b.text} />
          </p>
        ) : null,
      )}
    </section>
  );
}

export function BottomCta({ copy, env }: { copy: LandingCopy["hero"]; env: Env }) {
  const blocks = parseBlocks(copy);
  const headline = blocks[0]?.type === "p" ? stripBold(blocks[0].text) : "";
  const cta = blocks.find((b) => b.type === "cta");
  const fine = blocks[3]?.type === "p" ? blocks[3].text : "";
  if (!cta) return null;
  return (
    <section className="bottom-cta">
      <h2>{headline}</h2>
      <Cta label={cta.label} {...env} id="cta-bottom" />
      <p className="fine">{fine}</p>
    </section>
  );
}
