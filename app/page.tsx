import HeroSection from "./components/hero/HeroSection";
import HowItWorks from "./components/HowItWork";
import { AssessmentGoogleReviews } from "./components/GoogleReviews";
import HairTransformation from "./components/HairTransformation";
import HairGeneratorSection from "./components/HairGeneratorSection";

export default function Home() {
  return (
    <main className="min-h-screen w-full overflow-x-hidden">
      <HeroSection />
      <div className="mt-2 sm:mt-3 md:mt-4">
        <HairGeneratorSection />
      </div>
      <div className="py-8 sm:py-12 md:py-16 lg:py-20">
        <HowItWorks />
      </div>
      <div className="pb-8 sm:pb-12 md:pb-16 lg:pb-20">
        <HairTransformation />
      </div>
      <div className="pb-6 sm:pb-10 lg:pb-14">
        <AssessmentGoogleReviews />
      </div>
    </main>
  );
}
