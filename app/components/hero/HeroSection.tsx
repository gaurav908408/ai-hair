import HeroContent from "./HeroContent";
import HeroVisual from "./HeroVisual";
import { heroData } from "@/app/data/HeroData";

export default function HeroSection() {
  return (
    <section className="flex items-center bg-[#e8f8f6] pt-6 sm:pt-8 md:pt-10 lg:pt-12 pb-5 sm:pb-6 md:pb-8 lg:pb-10">
      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 items-center gap-8 sm:gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16 px-4 sm:px-6 md:px-10 lg:px-12 xl:px-16">
        <HeroContent data={heroData} />
        <HeroVisual />
      </div>
    </section>
  );
}
