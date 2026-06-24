import type { CSSProperties } from "react";
import styles from "./TheGate.module.css";

// "The Gate" — looping, non-interactive hero animation. Decorative: exposed to
// assistive tech as a single labeled image, with a static diagram shown under
// prefers-reduced-motion (handled in CSS).

type Vars = CSSProperties & { "--i"?: number };

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" fill="currentColor" />
    </svg>
  );
}

function StoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 9l1.5-4.5h15L21 9M4 9v10h16V9M4 9h16M9 19v-5h6v5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const ShieldSmall = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" fill="currentColor" /></svg>
);

const ARIA =
  "Animation: AI agents reach your Shopware store through AgentArmor. " +
  "Legitimate agents like ChatGPT and Gemini pass through; a scraper's stock data is redacted, " +
  "a promo bot is bounced back, and an injection attempt is sanitized.";

export function TheGate() {
  return (
    <div className={styles.wrap} role="img" aria-label={ARIA}>
      <div className={styles.stage}>
        <span className={`${styles.rail} ${styles.railA}`} aria-hidden="true" />
        <span className={`${styles.rail} ${styles.railB}`} aria-hidden="true" />
        <span className={`${styles.rail} ${styles.railC}`} aria-hidden="true" />

        <div className={styles.src} aria-hidden="true">
          <span className={styles.srcDot} />
          AI agents
        </div>

        <div className={styles.gate} aria-hidden="true">
          <ShieldIcon className={styles.gateShield} />
          <span className={styles.gateLabel}>AgentArmor</span>
          <span className={styles.scan} />
        </div>

        <div className={styles.store} aria-hidden="true">
          <StoreIcon className={styles.storeIcon} />
          Shopware
        </div>

        {/* animated chips */}
        <div className={`${styles.chip} ${styles.laneA} ${styles.pass}`} style={{ "--i": 0 } as Vars} aria-hidden="true">
          <span className={`${styles.pill} ${styles.greenify}`}>
            <span className={`${styles.dot} ${styles.dotOk}`} />
            <span className={styles.name}>ChatGPT</span>
          </span>
        </div>

        <div className={`${styles.chip} ${styles.laneB} ${styles.pass}`} style={{ "--i": 1 } as Vars} aria-hidden="true">
          <span className={`${styles.pill} ${styles.amberify}`}>
            <span className={`${styles.dot} ${styles.dotWarn}`} />
            <span className={styles.name}>Scraper</span>
            <span className={styles.payload}>
              <span className={styles.payRaw + " " + styles.redactOut}>stock: 87</span>
              <span className={styles.paySafe + " " + styles.redactIn}>in stock</span>
            </span>
          </span>
        </div>

        <div className={`${styles.chip} ${styles.laneC} ${styles.pass}`} style={{ "--i": 2 } as Vars} aria-hidden="true">
          <span className={`${styles.pill} ${styles.greenify}`}>
            <span className={`${styles.dot} ${styles.dotOk}`} />
            <span className={styles.name}>Gemini</span>
          </span>
        </div>

        <div className={`${styles.chip} ${styles.laneA} ${styles.pass}`} style={{ "--i": 3 } as Vars} aria-hidden="true">
          <span className={`${styles.pill} ${styles.amberify}`}>
            <span className={`${styles.dot} ${styles.dotWarn}`} />
            <span className={styles.name}>Order note</span>
            <span className={styles.payload}>
              <span className={styles.payRaw + " " + styles.redactOut}>{"'); DROP TABLE"}</span>
              <span className={styles.strike + " " + styles.strikeRun} />
              <span className={styles.paySafe + " " + styles.redactIn}>sanitized</span>
            </span>
          </span>
        </div>

        <div className={`${styles.chip} ${styles.laneB} ${styles.bounce}`} style={{ "--i": 4 } as Vars} aria-hidden="true">
          <span className={`${styles.pill} ${styles.amberify}`}>
            <span className={`${styles.dot} ${styles.dotBad}`} />
            <span className={styles.name}>Promo bot</span>
            <span className={styles.payload}>code reuse</span>
          </span>
        </div>

        {/* static diagram for prefers-reduced-motion */}
        <div className={styles.static} aria-hidden="true">
          <span className={`${styles.staticRow} ${styles.sr0} ${styles.ok}`}><CheckIcon /> ChatGPT &amp; Gemini pass</span>
          <span className={`${styles.staticRow} ${styles.sr1} ${styles.warn}`}><ShieldSmall /> Scraper data redacted</span>
          <span className={`${styles.staticRow} ${styles.sr2} ${styles.warn}`}><ShieldSmall /> Promo bot bounced</span>
          <span className={`${styles.staticRow} ${styles.sr3} ${styles.warn}`}><ShieldSmall /> Injection sanitized</span>
        </div>
      </div>
    </div>
  );
}
