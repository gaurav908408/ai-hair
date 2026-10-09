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
    <div className="grid grid-cols-3 gap-3 border-t border-teal-400 pt-5 sm:gap-5">
      {stats.map((item) => {
        const Icon = iconMap[item.icon as keyof typeof iconMap] || Activity;

        return (
          <div key={item.id} className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500 text-white">
              <Icon size={30} strokeWidth={2} />
            </div>

            <p className="text-sm font-medium text-gray-950 sm:text-base">
              {item.value}
            </p>

            <p className="text-sm text-gray-800 sm:text-base">
              {item.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
