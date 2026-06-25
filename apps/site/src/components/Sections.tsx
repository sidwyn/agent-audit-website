import type { LandingCopy } from "../lib/marketing";
import { parseBlocks, parseFaq, stripBold } from "../lib/markdown";
import { Cta } from "./Cta";
import { Inline } from "./Inline";
import { TheGate } from "./TheGate";
import { TryItDemo } from "./TryItDemo";

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
  const ctaIndex = blocks.findIndex((b) => b.type === "cta");
  const ctaBlock = ctaIndex >= 0 ? blocks[ctaIndex] : undefined;
  const before = (ctaIndex >= 0 ? blocks.slice(0, ctaIndex) : blocks)
    .filter((b) => b.type === "p")
    .map((b) => (b.type === "p" ? b.text : ""));
  const after = (ctaIndex >= 0 ? blocks.slice(ctaIndex + 1) : [])
    .filter((b) => b.type === "p")
    .map((b) => (b.type === "p" ? b.text : ""));
  const headline = before[0] ? stripBold(before[0]) : "";
  const subs = before.slice(1);
  return (
    <section className="hero">
      <p className="brand">AgentArmor</p>
      <h1>{headline}</h1>
      {subs.map((s, i) => (
        <p key={i} className="sub">
          <Inline text={s} />
        </p>
      ))}
      <p className="hero-offer">
        <span className="price-badge">Free plugin</span>
      </p>
      {ctaBlock?.type === "cta" && <Cta label={ctaBlock.label} {...env} id="cta-top" />}
      {after.map((f, i) => (
        <p key={i} className="fine">
          <Inline text={f} />
        </p>
      ))}
      <TheGate />
    </section>
  );
}

export function SeeItWork() {
  return (
    <section className="see-it-work" id="see-it-work">
      <h2>See AgentArmor work</h2>
      <p className="see-it-intro">
        Send a bad request. <strong>Enforce mode</strong> stops it; <strong>Watch mode</strong> only logs it.
      </p>
      <TryItDemo />
    </section>
  );
}

export function WhatItStops({ copy }: { copy: LandingCopy["whatItStops"] }) {
  const items = listItems(copy);
  return (
    <section className="get" id="what-it-stops">
      <h2>What AgentArmor stops</h2>
      <ul className="cards">
        {items.map((item) => {
          const m = item.match(/^\*\*(.+?)\*\*\s*([\s\S]*)$/);
          const lead = m?.[1] ?? "";
          const rest = m?.[2] ?? item;
          const sentences = rest.split(/(?<=\.)\s+(?=[A-Z*])/).filter((s) => s.trim().length > 0);
          return (
            <li key={item}>
              <strong>{lead}</strong>
              {sentences.map((s, i) => (
                <p key={i}>
                  <Inline text={s} />
                </p>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function PromoDepth({ copy }: { copy: LandingCopy["promoDepth"] }) {
  const ps = paragraphs(copy);
  const headline = ps[0] ? stripBold(ps[0]) : "";
  const body = ps.slice(1);
  return (
    <section className="promo-depth" id="promo-defense">
      <p className="eyebrow">Promo defense</p>
      <h2 className="promo-headline">{headline}</h2>
      {body.map((p, i) => (
        <p key={i} className="promo-body">
          <Inline text={p} />
        </p>
      ))}
    </section>
  );
}

export function HowItWorks({ copy }: { copy: LandingCopy["howItWorks"] }) {
  const ps = paragraphs(copy);
  return (
    <section className="how" id="how-it-works">
      <h2>How AgentArmor works</h2>
      {ps.map((p, i) => (
        <p key={i} className="how-body">
          <Inline text={p} />
        </p>
      ))}
    </section>
  );
}

export function AdminShots() {
  return (
    <section className="admin" id="admin">
      <h2>Inside your Shopware admin</h2>
      <p className="admin-intro">
        No new dashboard to learn. AgentArmor lives in Shopware admin: every agent decision, the euros AgentArmor
        protects, and controls you own.
      </p>

      <figure className="shot">
        <div className="shot-frame">
          <span className="shot-bar">
            <span />
            <span />
            <span />
          </span>
          <img
            src="/dashboard.png"
            alt="AgentArmor dashboard in Shopware admin: metric cards for catalog scraping, promo abuse, and untrusted text, with money protected and a live feed of every agent decision."
            width="1680"
            height="1050"
            loading="lazy"
          />
        </div>
        <figcaption>
          See every agent decision in one place. The <span className="cap-green">green</span> number is money
          AgentArmor has already saved you. The <span className="cap-amber">amber</span> number is what is still at
          risk while you are only watching.
        </figcaption>
      </figure>

      <figure className="shot">
        <div className="shot-frame">
          <span className="shot-bar">
            <span />
            <span />
            <span />
          </span>
          <img
            src="/trends.png"
            alt="AgentArmor daily trends table in Shopware admin: catalog scraping, promo abuse, and untrusted text broken down day by day, showing what watch mode would have blocked versus what enforce mode actually stopped."
            width="1680"
            height="1050"
            loading="lazy"
          />
        </div>
        <figcaption>
          Watch first, then enforce. The daily trends show what AgentArmor would have blocked while watching, so you
          can turn on enforcement once you trust the numbers.
        </figcaption>
      </figure>
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
      <h2>Pricing</h2>
      <div className="pricing-card">
        <div className="price">
          <span className="price-badge">Free plugin</span>
        </div>
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
      <h2>Who built AgentArmor</h2>
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
