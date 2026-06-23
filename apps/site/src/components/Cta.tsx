"use client";

import { useState, type FormEvent } from "react";

// Default Formspree endpoint (public id, safe to ship client-side).
// Override at build time with FORM_ENDPOINT if needed.
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xaqgnzga";

export type CtaProps = {
  label: string;
  stripeUrl?: string;
  formEndpoint?: string;
  id?: string;
};

type Status = "idle" | "submitting" | "success" | "error";

// Primary CTA. If STRIPE_PAYMENT_LINK is set it renders a payment link;
// otherwise it captures an email via Formspree over AJAX (no redirect, inline
// success). Falls back gracefully to the configured endpoint.
export function Cta({ label, stripeUrl, formEndpoint, id }: CtaProps) {
  const endpoint = formEndpoint ?? FORMSPREE_ENDPOINT;
  const [status, setStatus] = useState<Status>("idle");

  if (stripeUrl) {
    return (
      <a className="btn" href={stripeUrl} id={id} data-testid="cta-button">
        {label}
      </a>
    );
  }

  if (status === "success") {
    return (
      <p className="capture-success" data-testid="email-capture-success">
        Thanks, you&rsquo;re on the early-access list.
      </p>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("submitting");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        form.reset();
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className="capture" onSubmit={onSubmit} data-testid="email-capture">
      <input
        type="email"
        name="email"
        required
        placeholder="you@yourstore.com"
        aria-label="Email address"
      />
      {/* Honeypot: bots fill this, humans never see it. */}
      <input type="text" name="_gotcha" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <button type="submit" className="btn" id={id} disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : label}
      </button>
      {status === "error" && (
        <p className="capture-error" role="alert">
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  );
}
