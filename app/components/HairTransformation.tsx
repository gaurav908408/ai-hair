import Image from "next/image";
import React from "react";

type TransformationGroup = {
  title: string;
  src: string;
  alt: string;
};

const GROUPS: TransformationGroup[] = [
  {
    title: "Hair Transplant",
    src: "/images/images.jpg",
    alt: "Hair transplant before-and-after comparison",
  },
  {
    title: "Hair Replacement (Non-Surgical)",
    src: "/images/before-after-hair-restoration-male-pattern-baldness_948795-3663.avif",
    alt: "Hair replacement before-and-after comparison",
  },
];

const Transformations = () => {
  return (
    <section className="w-full px-4">
      <div className="container mx-auto max-w-7xl">
        <h2 className="text-2xl md:text-4xl font-semibold text-foreground text-center">
          Transformations At Berkowits
        </h2>

        <div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-12 md:mt-16 md:grid-cols-2 md:gap-10 lg:gap-16">
          {GROUPS.map((group) => (
            <TransformationCard key={group.title} group={group} />
          ))}
        </div>
      </div>
    </section>
  );
};

const TransformationCard = ({ group }: { group: TransformationGroup }) => {
  return (
    <div className="flex flex-col items-center">
      <h3 className="text-xl font-semibold text-foreground">{group.title}</h3>

      <div className="mt-6 w-full overflow-hidden rounded-[20px] border-2 border-[#56c9c3] shadow-sm">
        <div className="relative aspect-[1.07] w-full">
          <Image
            src={group.src}
            alt={group.alt}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        </div>

        <div className="flex bg-[#56c9c3] font-medium">
          <span className="flex-1 border-r-2 border-[#2a8f8b]/40 py-3 text-center text-lg text-white md:text-xl">
            Before
          </span>
          <span className="flex-1 py-3 text-center text-lg text-white md:text-xl">
            After
          </span>
        </div>
      </div>
    </div>
  );
};

export default Transformations;
