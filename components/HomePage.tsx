import React from 'react';
import LandingHeader from './landing/LandingHeader';
import Hero from './landing/Hero';
import TrustTicker from './landing/TrustTicker';
import CoreSkills from './landing/CoreSkills';
import HowItWorks from './landing/HowItWorks';
import InteractiveDemo from './landing/InteractiveDemo';
import FeaturesGrid from './landing/FeaturesGrid';
import Testimonials from './landing/Testimonials';
import Pricing from './landing/Pricing';
import FAQ from './landing/FAQ';
import CtaBanner from './landing/CtaBanner';
import LandingFooter from './landing/LandingFooter';

// Public landing page.
//
// `landing-root` is what scopes the marketing typography and the gradient /
// glass / grid helpers declared in index.html. It stops at this page on
// purpose: the signed-in app keeps Inter + Quicksand and its own surfaces,
// so redesigning the front door never leaks into a lesson.
//
// Every button and link here goes somewhere that exists — the account CTAs
// hit the real /login and /register routes rather than a modal that fakes a
// signup, and the section links resolve to sections this page renders.
// HomePage.test.tsx enforces both.
//
// The marketing copy (partners, testimonials, prices, learner counts) is
// placeholder content and lives in one module: components/landing/landingContent.ts.
const HomePage: React.FC = () => {
  return (
    <div className="landing-root min-h-screen flex flex-col bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-slate-100 selection:bg-blue-600 selection:text-white">
      <LandingHeader />

      <main className="flex-grow">
        <Hero />
        <TrustTicker />
        <CoreSkills />
        <HowItWorks />
        <InteractiveDemo />
        <FeaturesGrid />
        <Testimonials />
        <Pricing />
        <FAQ />
        <CtaBanner />
      </main>

      <LandingFooter />
    </div>
  );
};

export default HomePage;
