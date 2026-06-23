import {
  BuiltFor,
  Faq,
  Hero,
  HowItWorks,
  Pricing,
  TwoTruths,
  WhatItStops,
  WhoBuiltIt,
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
      <TwoTruths copy={copy.twoTruths} />
      <WhatItStops copy={copy.whatItStops} />
      <HowItWorks copy={copy.howItWorks} />
      <BuiltFor copy={copy.builtFor} />
      <Pricing copy={copy.pricing} env={env} />
      <WhoBuiltIt copy={copy.whoBuiltIt} />
      <Faq copy={copy.faq} />
      <footer>
        <p>
          AgentArmor · by Sidwyn Koh · <a href="mailto:sidwyn@gmail.com">sidwyn@gmail.com</a>
        </p>
        <p className="footnote">Runs inside your store. No cookies, no trackers. Your data stays yours.</p>
      </footer>
    </main>
  );
}
