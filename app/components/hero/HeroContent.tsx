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
    <div className="flex flex-col justify-center">
      <span className="mb-8 w-fit rounded-full border border-teal-500 px-3 py-2 text-sm text-teal-600 sm:text-base">
        {data.badge}
      </span>

      <h1 className="text-4xl font-bold leading-tight tracking-tight text-black sm:text-5xl lg:text-6xl">
        {data.title}{" "}
        <span className="block text-teal-500">
          {data.highlight}
        </span>
      </h1>

      <p className="mt-6 max-w-2xl text-base leading-relaxed text-gray-900 sm:text-xl">
        {data.description}
      </p>

      <div className="mt-8 max-w-xl">
        <HeroStats stats={data.stats} />
      </div>
    </div>
  );
}
