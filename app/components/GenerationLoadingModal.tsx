"use client";

import { useEffect, useState } from "react";

type GenerationLoadingModalProps = {
  isOpen: boolean;
};

export default function GenerationLoadingModal({ isOpen }: GenerationLoadingModalProps) {
  if (!isOpen) return null;
  return <LoadingModalDialog />;
}

function LoadingModalDialog() {
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    // Smooth simulated progress from 8% towards ~95% over ~32 seconds
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 35) {
          // Faster initial progress
          return prev + Math.random() * 3 + 1.5;
        } else if (prev < 65) {
          // Moderate progress around 30-65%
          return prev + Math.random() * 1.8 + 0.8;
        } else if (prev < 88) {
          // Gradual progress towards 88%
          return prev + Math.random() * 1.2 + 0.4;
        } else if (prev < 95) {
          // Slow creeping progress while waiting for final download
          return prev + Math.random() * 0.4 + 0.1;
        }
        return 95;
      });
    }, 450);

    return () => clearInterval(interval);
  }, []);

  const displayPercent = Math.min(99, Math.round(progress));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 md:p-6 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loading-modal-title"
    >
      <div className="relative w-full max-w-[620px] overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-2xl p-5 sm:p-8 md:p-12 text-center transition-all animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Animated Circular Spinner */}
        <div className="mx-auto flex items-center justify-center">
          <div className="relative h-16 w-16 sm:h-22 sm:w-22 md:h-28 md:w-28">
            <svg
              className="h-full w-full animate-spin"
              viewBox="0 0 100 100"
              style={{ animationDuration: "1.4s" }}
            >
              {/* Background Ring */}
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="#eaf4f3"
                strokeWidth="8"
                fill="none"
              />
              {/* Active Teal Arc */}
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="#00bba7"
                strokeWidth="8"
                strokeLinecap="round"
                fill="none"
                strokeDasharray="264"
                strokeDashoffset="175"
              />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h2
          id="loading-modal-title"
          className="mt-4 sm:mt-6 text-xl sm:text-2xl md:text-3xl lg:text-[40px] font-extrabold tracking-tight text-[#111827] leading-tight"
        >
          Creating your new look
        </h2>

        {/* Subtitle */}
        <p className="mt-2 sm:mt-3 text-sm sm:text-base md:text-lg font-semibold text-[#00bba7]">
          Applying your chosen style...
        </p>

        {/* Progress Bar Container */}
        <div className="mt-6 sm:mt-8 mx-auto w-full max-w-[500px]">
          <div className="h-4 sm:h-5 md:h-6 w-full rounded-full border border-[#00bba7] p-[2px] bg-white overflow-hidden">
            <div
              className="h-full rounded-full bg-[#00bba7] transition-all duration-300 ease-out"
              style={{ width: `${displayPercent}%` }}
            />
          </div>

          {/* Percentage */}
          <div className="mt-2 sm:mt-3 text-base sm:text-lg md:text-xl font-extrabold text-[#111827]">
            {displayPercent}%
          </div>
        </div>
      </div>
    </div>
  );
}
