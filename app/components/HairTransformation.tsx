import Image from "next/image";
import React from "react";

const TRANSFORMATIONS = [
  {
    title: "Hair Transplant",
    images: [
      {
        label: "Before",
        src: "/images/Before 1.jpg",
        alt: "Hair transformation before photo 1",
      },
      {
        label: "After",
        src: "/images/After 1.jpg",
        alt: "Hair transformation after photo 1",
      },
    ],
  },
  {
    title: "Hair Replacement (Non-Surgical)",
    images: [
      {
        label: "Before",
        src: "/images/Before 2.jpg",
        alt: "Hair transformation before photo 2",
      },
      {
        label: "After",
        src: "/images/After 2.jpg",
        alt: "Hair transformation after photo 2",
      },
    ],
  },
];

const Transformations = () => {
  return (
    <section className="w-full px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-7xl">
        <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground">
          Transformations At Berkowits
        </h2>

        <div className="mx-auto mt-6 sm:mt-8 grid max-w-6xl grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 md:gap-8">
          {TRANSFORMATIONS.map((transformation) => (
            <div
              key={transformation.title}
              className="overflow-hidden rounded-xl sm:rounded-2xl border border-[#56c9c3]/40 bg-[#f5f7f6] p-2.5 sm:p-4 shadow-xs"
            >
              <h3 className="mb-2.5 sm:mb-4 text-center text-sm sm:text-base md:text-lg font-semibold text-foreground">
                {transformation.title}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                {transformation.images.map((image) => (
                  <figure
                    key={image.label}
                    className="overflow-hidden rounded-lg sm:rounded-xl border border-[#56c9c3]/30 bg-white"
                  >
                    <div className="relative aspect-[4/5] w-full">
                      <Image
                        src={image.src}
                        alt={image.alt}
                        fill
                        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 20vw"
                        className="h-full w-full object-cover object-center"
                      />
                    </div>
                    <figcaption className="bg-[#56c9c3] px-1.5 py-1.5 sm:px-2 sm:py-2 text-center text-xs sm:text-sm md:text-base font-semibold text-white">
                      {image.label}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Transformations;
