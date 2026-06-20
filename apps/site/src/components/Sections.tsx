import type { LandingCopy } from "../lib/marketing";
import { parseBlocks, parseInline, stripBold } from "../lib/markdown";
import { Cta } from "./Cta";
import { Inline } from "./Inline";

type Env = { stripeUrl?: string; formEndpoint?: string };

export function Hero({ copy, env }: { copy: LandingCopy["hero"]; env: Env }) {
  const blocks = parseBlocks(copy);
  const eyebrow = blocks[0]?.type === "p" ? blocks[0].text : "";
  const headline = blocks[1]?.type === "p" ? stripBold(blocks[1].text) : "";
  const sub = blocks[2]?.type === "p" ? blocks[2].text : "";
  const cta = blocks.find((b) => b.type === "cta");
  return (
    <section className="hero">
      <p className="brand">AgentAudit</p>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{headline}</h1>
      <p className="sub">
        <Inline text={sub} />
      </p>
      {cta && <Cta label={cta.label} {...env} id="cta-top" />}
    </section>
  );
}

export function Stakes({ copy }: { copy: LandingCopy["stakes"] }) {
  const blocks = parseBlocks(copy);
  const body = blocks[0]?.type === "p" ? blocks[0].text : "";
  const list = blocks.find((b) => b.type === "ul");
  const items = list?.type === "ul" ? list.items : [];
  return (
    <section className="stakes">
      <h2>A new entrance, and nobody is watching it</h2>
      <p className="stakes-body">
        <Inline text={body} />
      </p>
      <div className="stat-cards">
        {items.map((item) => {
          const segs = parseInline(item);
          const numSeg = segs.find((s) => s.bold);
          const linkSeg = segs.find((s) => s.href);
          return (
            <div key={item} className="stat-card">
              <div className="stat-number">{numSeg?.text}</div>
              <div className="stat-desc">
                {linkSeg ? (
                  <a href={linkSeg.href} target="_blank" rel="noreferrer">
                    {linkSeg.text}
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function HowItWorks({ copy }: { copy: LandingCopy["howItWorks"] }) {
  const list = parseBlocks(copy).find((b) => b.type === "ol");
  return (
    <section className="how" id="how-it-works">
      <h2>Covered in three clicks</h2>
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

function ScanFeedCard() {
  return (
    <div className="demo-card demo-card--dark" aria-hidden="true">
      <div className="demo-card__header">AGENTAUDIT · ridge.com · live</div>
      <ul className="demo-feed">
        <li>
          <span className="feed-icon feed-icon--fail">✗</span>
          <span className="feed-key">promo SVEND</span>
          <span className="feed-val">10% leak live — found on public coupon sites</span>
        </li>
        <li>
          <span className="feed-icon feed-icon--fail">✗</span>
          <span className="feed-key">CA / AU / GB checkout</span>
          <span className="feed-val">buyers shown USD, not local currency</span>
        </li>
        <li>
          <span className="feed-icon feed-icon--warn">⚠</span>
          <span className="feed-key">cart total</span>
          <span className="feed-val">understates tax by ~10% to agents</span>
        </li>
        <li>
          <span className="feed-icon feed-icon--flag">⚑</span>
          <span className="feed-key">order #1182</span>
          <span className="feed-val">3 alias orders, one card — flagged as abuse</span>
        </li>
      </ul>
      <div className="demo-card__footer">4 issues · ranked by dollars · 1 new since your last change</div>
    </div>
  );
}

export function OngoingAudits({ copy }: { copy: LandingCopy["ongoingAudits"] }) {
  const blocks = parseBlocks(copy);
  const eyebrow = blocks[0]?.type === "p" ? blocks[0].text : "";
  const heading = blocks[1]?.type === "p" ? stripBold(blocks[1].text) : "";
  const body = blocks[2]?.type === "p" ? blocks[2].text : "";
  return (
    <section className="feature">
      <div className="feature-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="feature-h2">{heading}</h2>
        <p>
          <Inline text={body} />
        </p>
      </div>
      <div className="demo-card demo-card--email" aria-hidden="true">
        <div className="demo-card__header">📧 Your weekly AgentAudit · ridge.com</div>
        <div className="demo-card__body">
          <p className="demo-summary">2 new issues, 1 resolved since last week</p>
          <ul className="demo-feed">
            <li>
              <span className="feed-badge feed-badge--high">HIGH</span>
              promo BUNDLE20 stacks with SVEND → ~28% off
            </li>
            <li>
              <span className="feed-badge feed-badge--med">MED</span>
              AU buyers shown USD via agents (currency mismatch)
            </li>
            <li>
              <span className="feed-badge feed-badge--fixed">FIXED</span>
              cart tax now disclosed pre-checkout
            </li>
          </ul>
          <a className="demo-btn" href="#" onClick={(e) => e.preventDefault()}>
            View full report
          </a>
        </div>
      </div>
    </section>
  );
}

export function ContinuousScanning({ copy }: { copy: LandingCopy["continuousScanning"] }) {
  const blocks = parseBlocks(copy);
  const eyebrow = blocks[0]?.type === "p" ? blocks[0].text : "";
  const heading = blocks[1]?.type === "p" ? stripBold(blocks[1].text) : "";
  const body = blocks[2]?.type === "p" ? blocks[2].text : "";
  return (
    <section className="feature feature--flip">
      <div className="feature-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="feature-h2">{heading}</h2>
        <p>
          <Inline text={body} />
        </p>
      </div>
      <div className="demo-card demo-card--pr" aria-hidden="true">
        <div className="demo-card__header">⚠️ AgentAudit · change detected</div>
        <div className="demo-card__body">
          <p className="demo-label">Published: &ldquo;Titanium Wallet&rdquo; + promo BUNDLE20</p>
          <ul className="demo-findings">
            <li>→ BUNDLE20 is stackable with active code SVEND — agents can compound to ~28% off</li>
            <li>→ New variant exposed via UCP in USD only — AU/CA/GB buyers see wrong currency</li>
          </ul>
          <p className="demo-meta">Opens 2 vectors · Severity: High</p>
          <div className="demo-actions">
            <a className="demo-btn" href="#" onClick={(e) => e.preventDefault()}>Mark reviewed</a>
            <a className="demo-btn demo-btn--secondary" href="#" onClick={(e) => e.preventDefault()}>See the fix</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FraudMonitoring({ copy }: { copy: LandingCopy["fraudMonitoring"] }) {
  const blocks = parseBlocks(copy);
  const eyebrow = blocks[0]?.type === "p" ? blocks[0].text : "";
  const heading = blocks[1]?.type === "p" ? stripBold(blocks[1].text) : "";
  const body = blocks[2]?.type === "p" ? blocks[2].text : "";
  return (
    <section className="feature">
      <div className="feature-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="feature-h2">{heading}</h2>
        <p>
          <Inline text={body} />
        </p>
      </div>
      <div className="demo-card demo-card--dark" aria-hidden="true">
        <div className="demo-card__header">⚑ AgentAudit · order flags</div>
        <ul className="demo-feed">
          <li>
            <span className="feed-id">#1182</span>
            <span className="feed-val">buyer+a1@…, buyer+a2@…, buyer+a3@… · same card, code SVEND ×3</span>
            <span className="feed-badge feed-badge--high">abuse</span>
          </li>
          <li>
            <span className="feed-id">#1179</span>
            <span className="feed-val">agent order · ships-to ≠ billing region · high-velocity</span>
            <span className="feed-badge feed-badge--med">review</span>
          </li>
          <li>
            <span className="feed-id">#1170</span>
            <span className="feed-val">clean</span>
          </li>
        </ul>
      </div>
    </section>
  );
}

export function WhatWeTest({ copy }: { copy: LandingCopy["whatWeTest"] }) {
  const list = parseBlocks(copy).find((b) => b.type === "ul");
  return (
    <section className="what-we-test">
      <h2>Six ways an agent drains your store</h2>
      <ul className="test-grid">
        {(list?.type === "ul" ? list.items : []).map((item) => (
          <li key={item}>
            <Inline text={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Trust({ copy }: { copy: LandingCopy["trust"] }) {
  const list = parseBlocks(copy).find((b) => b.type === "ul");
  return (
    <section className="trust">
      <h2>Safe by design</h2>
      <ul className="trust-list">
        {(list?.type === "ul" ? list.items : []).map((item) => (
          <li key={item}>
            <Inline text={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Pricing({ copy, env }: { copy: LandingCopy["pricing"]; env: Env }) {
  const blocks = parseBlocks(copy);
  const body = blocks[0]?.type === "p" ? blocks[0].text : "";
  const cta = blocks.find((b) => b.type === "cta");
  return (
    <section className="pricing" id="pricing">
      <h2>One plan. $39/month.</h2>
      <div className="pricing-card">
        <p className="pricing-body">
          <Inline text={body} />
        </p>
        {cta && <Cta label={cta.label} {...env} id="cta-pricing" />}
      </div>
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
  const headline = blocks[1]?.type === "p" ? stripBold(blocks[1].text) : "";
  const cta = blocks.find((b) => b.type === "cta");
  if (!cta) return null;
  return (
    <section className="bottom-cta">
      <h2>{headline}</h2>
      <p className="bottom-cta-sub">Agent abuse and fraud protection for Shopify. $39/month, cancel anytime.</p>
      <Cta label={cta.label} {...env} id="cta-bottom" />
    </section>
  );
}
