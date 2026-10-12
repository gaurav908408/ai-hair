import Image from "next/image";
import React from "react";

const TRANSFORMATIONS = [
  {
    title: "Transformation 1",
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
    title: "Transformation 2",
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
    <section className="w-full px-4">
      <div className="container mx-auto max-w-7xl">
        <h2 className="text-center text-2xl font-semibold text-foreground md:text-4xl">
          Transformations At Berkowits
        </h2>

        <div className="mx-auto mt-8 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          {TRANSFORMATIONS.map((transformation) => (
            <div
              key={transformation.title}
              className="overflow-hidden rounded-2xl border border-[#56c9c3]/40 bg-[#f5f7f6] p-3 shadow-sm sm:p-4"
            >
              <h3 className="mb-3 text-center text-base font-semibold text-foreground sm:mb-4 sm:text-lg">
                {transformation.title}
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {transformation.images.map((image) => (
                  <figure
                    key={image.label}
                    className="overflow-hidden rounded-xl border border-[#56c9c3]/30 bg-white"
                  >
                    <div className="relative aspect-[4/5] w-full">
                      <Image
                        src={image.src}
                        alt={image.alt}
                        fill
                        sizes="(max-width: 768px) 45vw, 23vw"
                        className="h-full w-full object-contain object-center"
                      />
                    </div>
                    <figcaption className="bg-[#56c9c3] px-2 py-2 text-center text-sm font-semibold text-white sm:text-base">
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
