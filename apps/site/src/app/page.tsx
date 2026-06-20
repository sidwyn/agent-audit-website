import {
  About,
  BottomCta,
  ContinuousScanning,
  FraudMonitoring,
  Hero,
  HowItWorks,
  OngoingAudits,
  Pricing,
  Stakes,
  Trust,
  WhatWeTest,
} from "../components/Sections";
import { loadLandingCopy } from "../lib/marketing";

export default function Page() {
  const copy = loadLandingCopy();
  const env = {
    stripeUrl: process.env.STRIPE_PAYMENT_LINK,
    formEndpoint: process.env.FORM_ENDPOINT,
  };

  return (
    <main>
      <Hero copy={copy.hero} env={env} />
      <Stakes copy={copy.stakes} />
      <HowItWorks copy={copy.howItWorks} />
      <OngoingAudits copy={copy.ongoingAudits} />
      <ContinuousScanning copy={copy.continuousScanning} />
      <FraudMonitoring copy={copy.fraudMonitoring} />
      <WhatWeTest copy={copy.whatWeTest} />
      <Trust copy={copy.trust} />
      <Pricing copy={copy.pricing} env={env} />
      <About copy={copy.about} />
      <BottomCta copy={copy.hero} env={env} />
      <footer>
        <p>
          AgentAudit · run by Sidwyn Koh · <a href="mailto:sidwyn@gmail.com">sidwyn@gmail.com</a>
        </p>
        <p className="footnote">No cookies, no trackers. Merchant data is deleted on cancellation.</p>
      </footer>
    </main>
  );
}
