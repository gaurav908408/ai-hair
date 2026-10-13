import { Camera, Scissors, ClipboardCheck, LucideIcon } from "lucide-react";
import React from "react";

type Step = {
  number: number;
  icon: LucideIcon;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    number: 1,
    icon: Camera,
    title: "Upload or click your photo",
    description:
      "Take a selfie or upload from your gallery. A simple front-facing photo works best",
  },
  {
    number: 2,
    icon: Scissors,
    title: "Pick a hairstyle",
    description:
      "Choose from styles that match your choice, face shape and age. Our AI is built for Indian faces, features, and hair types",
  },
  {
    number: 3,
    icon: ClipboardCheck,
    title: "See your result",
    description:
      "Your AI transformation appears instantly. Download it, share it, or connect with our expert to make it real",
  },
];

const HowItWorks = () => {
  return (
    <section className="w-full px-4 sm:px-6 lg:px-8">
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground text-center">
        How It Works
      </h2>
      <div className="container mx-auto grid max-w-7xl grid-cols-1 gap-5 sm:gap-6 md:grid-cols-3 md:gap-8 mt-6 sm:mt-8 md:mt-10">
        {STEPS.map((step) => (
          <StepCard key={step.number} step={step} />
        ))}
      </div>
    </section>
  );
};

const StepCard = ({ step }: { step: Step }) => {
  const { number, icon: Icon, title, description } = step;
  return (
    <div className="relative rounded-2xl sm:rounded-3xl px-5 py-7 sm:px-6 sm:py-9 md:px-8 md:pb-12 md:pt-14 bg-gray-100/50 transition-shadow hover:shadow-xs">
      <div className="absolute -left-1.5 -top-1.5 sm:-left-2 sm:-top-2 flex size-8 sm:size-10 items-center justify-center rounded-full bg-white text-sm sm:text-base font-bold text-green-600 shadow-md">
        {number}
      </div>

      <div className="flex flex-col items-center text-center">
        <div className="flex size-12 sm:size-16 items-center justify-center rounded-full bg-green-100">
          <Icon className="size-6 sm:size-8 text-green-600" strokeWidth={2} />
        </div>

        <h3 className="mt-4 sm:mt-6 text-base sm:text-lg font-semibold text-foreground">{title}</h3>

        <p className="mt-2.5 sm:mt-4 text-xs sm:text-sm md:text-base lg:text-lg leading-relaxed text-muted-foreground text-pretty">
          {description}
        </p>
      </div>
    </div>
  );
};

export default HowItWorks;
