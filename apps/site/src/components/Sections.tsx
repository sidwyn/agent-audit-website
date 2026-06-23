import type { LandingCopy } from "../lib/marketing";
import { parseBlocks, parseFaq, stripBold } from "../lib/markdown";
import { Cta } from "./Cta";
import { Inline } from "./Inline";

type Env = { stripeUrl?: string; formEndpoint?: string };

function listItems(copy: string): string[] {
  const list = parseBlocks(copy).find((b) => b.type === "ul");
  return list?.type === "ul" ? list.items : [];
}

function paragraphs(copy: string): string[] {
  return parseBlocks(copy)
    .filter((b) => b.type === "p")
    .map((b) => (b.type === "p" ? b.text : ""));
}

export function Hero({ copy, env }: { copy: LandingCopy["hero"]; env: Env }) {
  const blocks = parseBlocks(copy);
  const ps = blocks.filter((b) => b.type === "p").map((b) => (b.type === "p" ? b.text : ""));
  const headline = ps[0] ? stripBold(ps[0]) : "";
  const sub = ps[1] ?? "";
  const fine = ps[2] ?? "";
  const cta = blocks.find((b) => b.type === "cta");
  return (
    <section className="hero">
      <p className="brand">AgentArmor</p>
      <h1>{headline}</h1>
      <p className="sub">
        <Inline text={sub} />
      </p>
      {cta && <Cta label={cta.label} {...env} id="cta-top" />}
      {fine && <p className="fine">{fine}</p>}
      <p className="sample-link">
        <a href="#what-it-stops">See what it catches ↓</a>
      </p>
    </section>
  );
}

export function TwoTruths({ copy }: { copy: LandingCopy["twoTruths"] }) {
  const items = listItems(copy);
  return (
    <section className="truths" id="two-truths">
      <h2>Two things are true about agent traffic</h2>
      <div className="truths-grid">
        {items.map((item) => (
          <div key={item} className="truth-card">
            <Inline text={item} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function WhatItStops({ copy }: { copy: LandingCopy["whatItStops"] }) {
  const items = listItems(copy);
  return (
    <section className="get" id="what-it-stops">
      <h2>What it stops</h2>
      <ul className="cards">
        {items.map((item) => (
          <li key={item}>
            <Inline text={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HowItWorks({ copy }: { copy: LandingCopy["howItWorks"] }) {
  const ps = paragraphs(copy);
  return (
    <section className="how" id="how-it-works">
      <h2>How it works</h2>
      <div className="guarantee">
        {ps.map((p, i) => (
          <p key={i}>
            <Inline text={p} />
          </p>
        ))}
      </div>
    </section>
  );
}

export function BuiltFor({ copy }: { copy: LandingCopy["builtFor"] }) {
  const ps = paragraphs(copy);
  return (
    <section className="built-for" id="built-for">
      <h2>Built for self-hosted Shopware</h2>
      {ps.map((p, i) => (
        <p key={i} className="built-for-body">
          <Inline text={p} />
        </p>
      ))}
    </section>
  );
}

export function Pricing({ copy, env }: { copy: LandingCopy["pricing"]; env: Env }) {
  const blocks = parseBlocks(copy);
  const body = blocks.find((b) => b.type === "p");
  const cta = blocks.find((b) => b.type === "cta");
  return (
    <section className="pricing" id="pricing">
      <h2>One plan, every threat.</h2>
      <div className="pricing-card">
        <p className="pricing-body">{body?.type === "p" ? <Inline text={body.text} /> : null}</p>
        {cta && <Cta label={cta.label} {...env} id="cta-pricing" />}
      </div>
    </section>
  );
}

export function WhoBuiltIt({ copy }: { copy: LandingCopy["whoBuiltIt"] }) {
  const ps = paragraphs(copy);
  return (
    <section className="about" id="about">
      <h2>Who built it</h2>
      <div className="about-inner">
        <img
          alt="Sidwyn Koh"
          className="about-portrait"
          height="128"
          loading="lazy"
          src="/sidwyn-koh.jpeg"
          width="128"
        />
        <div className="about-copy">
          {ps.map((p, i) => (
            <p key={i}>
              <Inline text={p} />
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Faq({ copy }: { copy: LandingCopy["faq"] }) {
  const entries = parseFaq(copy);
  return (
    <section className="faq" id="faq">
      <h2>FAQ</h2>
      {entries.map((entry) => (
        <details key={entry.q}>
          <summary>{entry.q}</summary>
          <p>
            <Inline text={entry.a} />
          </p>
        </details>
      ))}
    </section>
  );
}
