export type HairstyleOption = {
  id: string;
  name: string;
  image: string | null;
};

export const HAIRSTYLES: HairstyleOption[] = [
  { id: "comb-over", name: "Comb Over", image: "/images/CombOver.webp" },
  { id: "faux-hawk", name: "Faux Hawk", image: "/images/FauxHawk.webp" },
  {
    id: "high-tight-fade",
    name: "High Tight Fade",
    image: "/images/HighTightFade.webp",
  },
  { id: "low-fade", name: "Low Fade", image: "/images/LowFade.webp" },
  { id: "pompadour", name: "Pompadour", image: "/images/Pompadour.webp" },
  { id: "slick-back", name: "Slick Back", image: "/images/SlickBack.webp" },
  {
    id: "textured-fringe",
    name: "Textured Fringe",
    image: "/images/TexturedFringe.webp",
  },
  {
    id: "undercut-long-hair",
    name: "Undercut Long Hair",
    image: "/images/UndercutLongHair copy.webp",
  },
];
