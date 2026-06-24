"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./TryItDemo.module.css";

type Mode = "watch" | "enforce";
type Attack = "scraper" | "promo" | "injection";

type Outcome = {
  motion: "pass" | "bounce";
  chipClass: "caught" | "blocked" | "stripped";
  verb: string;
  rest: string;
  tone: "watch" | "blocked" | "stripped";
  announce: string;
};

const ATTACKS: { id: Attack; name: string; payload: string }[] = [
  { id: "scraper", name: "Scraper", payload: "GET /catalog · sku, stock" },
  { id: "promo", name: "Promo bot", payload: "code SAVE10 ×900" },
  { id: "injection", name: "Injection", payload: "'); DROP TABLE" },
];

function decide(mode: Mode, attack: Attack): Outcome {
  if (mode === "watch") {
    const rest: Record<Attack, string> = {
      scraper: "catalog.dlp · sku, stock exposed · agent=untrusted",
      promo: "promo.dedup · code SAVE10 reused · agent=untrusted",
      injection: "input.dlp · '); DROP TABLE detected",
    };
    return {
      motion: "pass",
      chipClass: "caught",
      verb: "would_block",
      rest: rest[attack],
      tone: "watch",
      announce: "Watch mode: request passed through. AgentArmor logged a would_block decision. Nothing was stopped.",
    };
  }
  // enforce
  if (attack === "promo") {
    return {
      motion: "bounce",
      chipClass: "blocked",
      verb: "blocked",
      rest: "promo.dedup · 429 returned · code rejected",
      tone: "blocked",
      announce: "Enforce mode: the promo bot was blocked at the gate.",
    };
  }
  const rest: Record<Attack, string> = {
    scraper: "catalog.dlp · sku, stock redacted",
    promo: "",
    injection: "input.dlp · payload neutralized",
  };
  return {
    motion: "pass",
    chipClass: "stripped",
    verb: "stripped",
    rest: rest[attack],
    tone: "stripped",
    announce: `Enforce mode: the ${attack} request was let through with the unsafe data stripped.`,
  };
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function TryItDemo() {
  const [mode, setMode] = useState<Mode>("watch");
  const [runId, setRunId] = useState(0);
  const [active, setActive] = useState<{ attack: Attack; outcome: Outcome } | null>(null);
  const [log, setLog] = useState<{ key: number; mode: Mode; outcome: Outcome }[]>([]);
  const [announce, setAnnounce] = useState("");
  const reduced = usePrefersReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function send(attack: Attack) {
    const outcome = decide(mode, attack);
    const key = runId + 1;
    setRunId(key);
    setActive({ attack, outcome });
    setLog((l) => [{ key, mode, outcome }, ...l].slice(0, 5));
    setAnnounce(outcome.announce);
  }

  const meta = active ? ATTACKS.find((a) => a.id === active.attack)! : null;

  // chip class: while running use the motion animation; reduced-motion places it.
  const chipClasses = active
    ? [
        styles.tChip,
        styles[active.outcome.chipClass],
        reduced
          ? `${styles.staticPlaced} ${active.outcome.motion === "bounce" ? styles.staticBounce : styles.staticPass}`
          : active.outcome.motion === "bounce"
            ? styles.runBounce
            : styles.runPass,
      ].join(" ")
    : "";

  return (
    <div className={styles.demo}>
      <div className={styles.controls}>
        <div className={styles.control}>
          <span className={styles.controlLabel} id="mode-label">
            Mode
          </span>
          <div className={styles.toggle} role="group" aria-labelledby="mode-label">
            <button
              type="button"
              className={styles.toggleBtn}
              aria-pressed={mode === "watch"}
              onClick={() => setMode("watch")}
            >
              Watch
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${styles.enforceOn}`}
              aria-pressed={mode === "enforce"}
              onClick={() => setMode("enforce")}
            >
              Enforce
            </button>
          </div>
        </div>

        <div className={styles.control}>
          <span className={styles.controlLabel} id="attack-label">
            Send a malicious request
          </span>
          <div className={styles.attacks} role="group" aria-labelledby="attack-label">
            {ATTACKS.map((a) => (
              <button key={a.id} type="button" className={styles.attackBtn} onClick={() => send(a.id)}>
                {a.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.track} aria-hidden="true">
        <div className={`${styles.tGate} ${active ? styles.lit : ""}`}>
          <span className={styles.tGateLabel}>AgentArmor</span>
        </div>
        <span className={styles.tStore}>Store</span>
        {active && meta && (
          <div key={runId} className={chipClasses}>
            <span className={styles.tChipName}>{meta.name}</span>
            <span className={styles.tChipPay}>{meta.payload}</span>
          </div>
        )}
      </div>

      <p className={styles.logHead}>Decision log</p>
      <ul className={styles.log}>
        {log.map((entry) => (
          <li
            key={entry.key}
            className={`${styles.logLine} ${
              entry.outcome.tone === "watch"
                ? styles.logWatch
                : entry.outcome.tone === "blocked"
                  ? styles.logBlocked
                  : styles.logStripped
            }`}
          >
            <span className={styles.logVerb}>
              {entry.mode} · {entry.outcome.verb}
            </span>
            <span className={styles.logRest}>{entry.outcome.rest}</span>
          </li>
        ))}
      </ul>

      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
