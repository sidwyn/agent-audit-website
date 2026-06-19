import {
  About,
  BottomCta,
  Duality,
  Faq,
  Guarantee,
  Hero,
  HowItWorks,
  LiveDataset,
  Monitoring,
  StatsBar,
  WhatYouGet,
  WhoItsFor,
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
      <Duality copy={copy.duality} />
      <StatsBar copy={copy.statsBar} />
      <WhatYouGet copy={copy.whatYouGet} />
      <HowItWorks copy={copy.howItWorks} />
      <LiveDataset copy={copy.liveDataset} />
      <Monitoring copy={copy.monitoring} />
      <Guarantee copy={copy.guarantee} />
      <WhoItsFor copy={copy.whoItsFor} />
      <Faq copy={copy.faq} />
      <About copy={copy.about} />
      <BottomCta copy={copy.hero} env={env} />
      <footer>
        <p>
          AgentAudit · run by Sidwyn Koh · <a href="mailto:sidwyn@gmail.com">sidwyn@gmail.com</a>
        </p>
        <p className="footnote">No cookies, no trackers. Merchant data is deleted after delivery.</p>
      </footer>
    </main>
  );
}
