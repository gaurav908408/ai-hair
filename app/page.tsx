import HeroSection from "./components/hero/HeroSection";
import HowItWorks from "./components/HowItWork";
import GoogleReviews, { AssessmentGoogleReviews } from "./components/GoogleReviews";
import HairTransformation from "./components/HairTransformation";

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <br />
      <br />
      <br />
      <br />
      <HowItWorks/>
      <HairTransformation/>
      <AssessmentGoogleReviews />
       
    </main>
  );
}
