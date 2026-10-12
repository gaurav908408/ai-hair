import HeroSection from "./components/hero/HeroSection";
import HowItWorks from "./components/HowItWork";
import GoogleReviews, { AssessmentGoogleReviews } from "./components/GoogleReviews";
import HairTransformation from "./components/HairTransformation";
import HairGeneratorSection from "./components/HairGeneratorSection";

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <HairGeneratorSection />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <HowItWorks/>
      <br />
      <br />
      <br />
      <br />
      <HairTransformation/>
      <AssessmentGoogleReviews />
       
    </main>
  );
}
