export type CtaProps = {
  label: string;
  stripeUrl?: string;
  formEndpoint?: string;
  id?: string;
};

// Primary CTA links to the Stripe payment link; when STRIPE_PAYMENT_LINK is
// unset at build time we fall back to a plain-HTML email capture form that
// POSTs to FORM_ENDPOINT (Formspree-style) — works with JS disabled.
export function Cta({ label, stripeUrl, formEndpoint, id }: CtaProps) {
  if (stripeUrl) {
    return (
      <a className="btn" href={stripeUrl} id={id} data-testid="cta-button">
        {label}
      </a>
    );
  }
  return (
    <form className="capture" method="POST" action={formEndpoint ?? "#"} data-testid="email-capture">
      <input
        type="email"
        name="email"
        required
        placeholder="you@yourstore.com"
        aria-label="Email address"
      />
      <button type="submit" className="btn">
        {label}
      </button>
    </form>
  );
}
