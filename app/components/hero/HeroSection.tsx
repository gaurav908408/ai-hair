import HeroContent from "./HeroContent";
import HeroVisual from "./HeroVisual";
import { heroData } from "@/app/data/HeroData";

export default function HeroSection() {
  return (
    <section className="min-h-screen bg-[#e8f8f6]">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 items-center gap-10 px-6 py-12 lg:grid-cols-2 lg:px-16">
        <HeroContent data={heroData} />
        <HeroVisual />
      </div>
    </section>
  );
}
