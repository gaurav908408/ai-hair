import { MapPin, Users, Activity } from "lucide-react";

const iconMap = {
  "map-pin": MapPin,
  users: Users,
  activity: Activity,
};

export interface StatItem {
  id: number;
  icon: string;
  value: string;
  label: string;
}

export interface HeroStatsProps {
  stats?: StatItem[];
}

export default function HeroStats({ stats = [] }: HeroStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-5 w-full">
      {stats.map((item) => {
        const Icon = iconMap[item.icon as keyof typeof iconMap] || Activity;

        return (
          <div key={item.id} className="flex flex-col items-center text-center px-0.5 sm:px-1 min-w-0">
            <div className="mb-2.5 sm:mb-3 flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-[#00bba7] text-white shrink-0 shadow-xs">
              <Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.2} />
            </div>

            {item.id === 2 ? (
              <>
                <p className="text-xs sm:text-sm md:text-base font-bold text-[#111827] leading-tight">
                  1.5M+
                </p>
                <p className="text-[11px] sm:text-xs md:text-sm text-[#374151] leading-tight mt-0.5 sm:mt-1">
                  <span className="block">patients</span>
                  <span className="block">treated</span>
                </p>
              </>
            ) : (
              <>
                <p className="text-xs sm:text-sm md:text-base font-bold text-[#111827] leading-tight">
                  {item.value}
                </p>
                <p className="text-[11px] sm:text-xs md:text-sm text-[#374151] leading-tight mt-0.5 sm:mt-1">
                  {item.label}
                </p>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
