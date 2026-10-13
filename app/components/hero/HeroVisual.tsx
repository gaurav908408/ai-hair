import Image from "next/image";

export default function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl">
      <div className="relative aspect-[4/3] sm:aspect-square w-full overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-teal-200/60 shadow-md flex items-center justify-center">
        <Image
          src="/images/hero-image.webp"
          alt="AI hair transformation preview"
          fill
          priority
          sizes="(max-width: 640px) 95vw, (max-width: 1024px) 70vw, 45vw"
          className="object-cover object-top"
        />
      </div>
    </div>
  );
}
