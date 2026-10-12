"use client";

import { useEffect, useState } from "react";

type GenerationLoadingModalProps = {
  isOpen: boolean;
};

export default function GenerationLoadingModal({ isOpen }: GenerationLoadingModalProps) {
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    if (!isOpen) {
      setProgress(8);
      return;
    }

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
  }, [isOpen]);

  if (!isOpen) return null;

  const displayPercent = Math.min(99, Math.round(progress));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loading-modal-title"
    >
      <div className="relative w-full max-w-[620px] overflow-hidden rounded-3xl bg-white shadow-2xl p-8 sm:p-12 text-center transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Animated Circular Spinner */}
        <div className="mx-auto flex items-center justify-center">
          <div className="relative h-24 w-24 sm:h-28 sm:w-28">
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
          className="mt-6 text-3xl sm:text-[42px] font-extrabold tracking-tight text-[#111827] leading-tight"
        >
          Creating your new look
        </h2>

        {/* Subtitle */}
        <p className="mt-3 text-base sm:text-[18px] font-semibold text-[#00bba7]">
          Applying your chosen style...
        </p>

        {/* Progress Bar Container */}
        <div className="mt-8 mx-auto w-full max-w-[500px]">
          <div className="h-5 sm:h-6 w-full rounded-full border border-[#00bba7] p-[2.5px] bg-white overflow-hidden">
            <div
              className="h-full rounded-full bg-[#00bba7] transition-all duration-300 ease-out"
              style={{ width: `${displayPercent}%` }}
            />
          </div>

          {/* Percentage */}
          <div className="mt-3 text-lg sm:text-xl font-extrabold text-[#111827]">
            {displayPercent}%
          </div>
        </div>
      </div>
    </div>
  );
}
