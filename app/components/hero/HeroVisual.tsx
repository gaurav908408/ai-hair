import Image from "next/image";

export default function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-gradient-to-tr from-teal-200 via-teal-100 to-teal-300 border border-teal-300/50 shadow-xl flex items-center justify-center">
         <Image
            src="/images/hero-image.webp"
            alt="AI hair transformation preview"
            width={500}
            height={350}
            className="size-full"
          />
      </div>
    </div>
  );
}
