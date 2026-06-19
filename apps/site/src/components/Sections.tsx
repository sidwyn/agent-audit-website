import type { LandingCopy } from "../lib/marketing";
import { parseBlocks, parseFaq, parseInline, stripBold } from "../lib/markdown";
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
        <a
          href="/sample-report.pdf"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="sample-report-link"
        >
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
      <h2>Why optimize for agents?</h2>
      <ul>
        {items.map((item, index) => (
          <li key={item}>
            <StatWithFootnote index={index + 1} text={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatWithFootnote({ index, text }: { index: number; text: string }) {
  const segments = parseInline(text);
  const href = segments.find((segment) => segment.href)?.href;

  return (
    <>
      {segments.map((segment, segmentIndex) =>
        segment.bold ? <strong key={segmentIndex}>{segment.text}</strong> : segment.text,
      )}
      {href ? (
        <sup>
          <a
            aria-label={`Source ${index}`}
            className="footnote-ref"
            href={href}
            rel="noreferrer"
            target="_blank"
          >
            {index}
          </a>
        </sup>
      ) : null}
    </>
  );
}

export function Duality({ copy }: { copy: LandingCopy["duality"] }) {
  const blocks = parseBlocks(copy);
  return (
    <section className="duality">
      <h2>Two things are true about agent traffic</h2>
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

export function LiveDataset({ copy }: { copy: LandingCopy["liveDataset"] }) {
  const blocks = parseBlocks(copy);
  const list = blocks.find((b) => b.type === "ul");
  const framing = blocks.find((b) => b.type === "p");
  return (
    <section className="live-dataset">
      <h2>What we&apos;re seeing across stores</h2>
      {list?.type === "ul" && (
        <ul>
          {list.items.map((item) => (
            <li key={item}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      )}
      {framing && (
        <p className="framing">
          <Inline text={framing.text} />
        </p>
      )}
    </section>
  );
}

export function Monitoring({ copy }: { copy: LandingCopy["monitoring"] }) {
  const blocks = parseBlocks(copy);
  return (
    <section className="monitoring">
      <h2>An audit is a snapshot. The channel moves.</h2>
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

export function WhoItsFor({ copy }: { copy: LandingCopy["whoItsFor"] }) {
  const blocks = parseBlocks(copy);
  return (
    <section className="who">
      <h2>Who this is for</h2>
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

export function WhatYouGet({ copy }: { copy: LandingCopy["whatYouGet"] }) {
  const blocks = parseBlocks(copy);
  const intro = blocks[0]?.type === "p" ? blocks[0].text : "";
  const list = blocks.find((b) => b.type === "ol");
  return (
    <section className="get" id="what-you-get">
      <h2>A scored report and a 30-minute readout call</h2>
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
      <h2>Three steps, three business days</h2>
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
          {blocks.map((b, i) =>
            b.type === "p" ? (
              <p key={i}>
                <Inline text={b.text} />
              </p>
            ) : null,
          )}
        </div>
      </div>
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
