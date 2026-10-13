import HeroStats from "./HeroStats";

export interface HeroStatItem {
  id: number;
  icon: string;
  value: string;
  label: string;
}

export interface HeroData {
  badge: string;
  title: string;
  highlight: string;
  description: string;
  stats: HeroStatItem[];
  images?: Record<string, unknown>;
}

export interface HeroContentProps {
  data: HeroData;
}

export default function HeroContent({ data }: HeroContentProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center lg:items-start lg:text-left">
      <span className="mb-4 sm:mb-6 lg:mb-8 inline-flex items-center rounded-full border border-[#00bba7] bg-[#e0f7f5]/40 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-[#00a896] leading-normal shadow-2xs">
        {data.badge}
      </span>

      <h1 className="text-3xl sm:text-4xl lg:text-[44px] xl:text-[50px] font-extrabold leading-[1.2] tracking-tight text-[#111827]">
        <span className="block">See yourself</span>
        <span className="block">with full hair in</span>
        <span className="block text-[#00bba7]">30 seconds</span>
      </h1>

      <p className="mt-4 sm:mt-5 max-w-md lg:max-w-xl text-[15px] sm:text-base md:text-lg leading-relaxed text-[#111827] mx-auto lg:mx-0 font-normal">
        {data.description}
      </p>

      <div className="my-6 sm:my-8 w-full border-t border-[#76d7d0]/80" />

      <div className="w-full max-w-xl mx-auto lg:mx-0">
        <HeroStats stats={data.stats} />
      </div>
    </div>
  );
}
