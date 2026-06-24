import {
  AdminShots,
  BuiltFor,
  Faq,
  Hero,
  HowItWorks,
  Pricing,
  SeeItWork,
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
      <WhatItStops copy={copy.whatItStops} />
      <SeeItWork />
      <HowItWorks copy={copy.howItWorks} />
      <AdminShots />
      <BuiltFor copy={copy.builtFor} />
      <Pricing copy={copy.pricing} env={env} />
      <WhoBuiltIt copy={copy.whoBuiltIt} />
      <Faq copy={copy.faq} />
      <footer>
        <p>AgentArmor by AgentAudit</p>
        <p className="footnote">Runs inside your store. No cookies, no trackers. Your data stays yours.</p>
      </footer>
    </main>
  );
}
