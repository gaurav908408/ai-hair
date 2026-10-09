
export type HeroStat = {
  id: number;
  icon: "map-pin" | "users" | "activity";
  value: string;
  label: string;
};

export type HeroData = {
  badge: string;
  title: string;
  highlight: string;
  description: string;
  stats: HeroStat[];
  images: Record<string, string>;
};

export const heroData: HeroData = {
  badge: "38+ years of hair restoration expertise",

  title: "See yourself with full hair in",
  highlight: "30 seconds",

  description:
    "Ideal for people looking to visualize results before hair transplant & hair replacement",

  stats: [
    {
      id: 1,
      icon: "map-pin",
      value: "45+ clinics",
      label: "Pan India",
    },
    {
      id: 2,
      icon: "users",
      value: "1.5M+ patients",
      label: "treated",
    },
    {
      id: 3,
      icon: "activity",
      value: "Doctor Led",
      label: "Treatments",
    },
  ],

  images: {},
};
