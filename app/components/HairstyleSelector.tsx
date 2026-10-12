"use client";

import Image from "next/image";
import { Check, Image as ImageIcon, Zap } from "lucide-react";
import { useState } from "react";
import type { HairstyleOption } from "../data/hairstyles";
import { HAIRSTYLES } from "../data/hairstyles";

type HairstyleSelectorProps = {
  hairstyles?: HairstyleOption[];
  selectedHairstyleId?: string;
  hasPhoto: boolean;
  onHairstyleSelect?: (hairstyle: HairstyleOption) => void;
  onGenerate?: (hairstyle: HairstyleOption) => void;
  isGenerating?: boolean;
  generationError?: string;
  className?: string;
};

export default function HairstyleSelector({
  hairstyles = HAIRSTYLES,
  selectedHairstyleId,
  hasPhoto,
  onHairstyleSelect,
  onGenerate,
  isGenerating = false,
  generationError = "",
  className = "",
}: HairstyleSelectorProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    null,
  );
  const selectedId = selectedHairstyleId ?? internalSelectedId;
  const selectedHairstyle =
    hairstyles.find((hairstyle) => hairstyle.id === selectedId) ?? null;
  const canGenerate =
    hasPhoto && selectedHairstyle !== null && onGenerate !== undefined;

  const selectHairstyle = (hairstyle: HairstyleOption) => {
    setInternalSelectedId(hairstyle.id);
    onHairstyleSelect?.(hairstyle);
  };

  return (
    <aside
      className={`flex h-[680px] min-h-0 w-full flex-col overflow-hidden bg-[#f1faf9] p-4 sm:p-5 lg:h-[760px] lg:p-4 ${className}`.trim()}
      aria-labelledby="hairstyle-selector-heading"
    >
      <h2 id="hairstyle-selector-heading" className="sr-only">
        Select your hairstyle
      </h2>

      <div
        className="min-h-0 flex-1 overscroll-contain overflow-y-auto scroll-smooth px-1 [scrollbar-color:#8bcac5_transparent] [scrollbar-width:thin]"
        aria-label="Hairstyle options"
        tabIndex={0}
      >
        <div className="mx-auto grid max-w-[500px] grid-cols-2 gap-3 sm:gap-4">
          {hairstyles.map((hairstyle) => {
            const isSelected = hairstyle.id === selectedId;

            return (
              <button
                key={hairstyle.id}
                type="button"
                onClick={() => selectHairstyle(hairstyle)}
                disabled={!hasPhoto || isGenerating}
                aria-pressed={isSelected}
                className={`group relative min-w-0 overflow-hidden rounded-2xl border bg-white text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#258d87] disabled:cursor-not-allowed disabled:opacity-50 ${
                  hasPhoto ? "hover:border-[#319f99]" : ""
                } ${
                  isSelected
                    ? "border-2 border-[#258d87] shadow-sm"
                    : "border-[#d5e8e5]"
                }`}
              >
                <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#f7fbfa]">
                  {hairstyle.image ? (
                    <Image
                      src={hairstyle.image}
                      alt={`${hairstyle.name} hairstyle`}
                      fill
                      sizes="(max-width: 640px) 42vw, (max-width: 1024px) 22vw, 16vw"
                      className="object-contain p-2"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2 text-center text-[#829794]">
                      <ImageIcon aria-hidden="true" size={25} strokeWidth={1.6} />
                      <span className="text-[10px] leading-4 sm:text-xs">
                        Hairstyle image unavailable
                      </span>
                    </div>
                  )}
                  {isSelected && (
                    <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#258d87] text-white">
                      <Check aria-hidden="true" size={15} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <span className="block min-h-10 px-2 py-2 text-center text-xs font-semibold leading-4 text-[#203330] sm:text-sm">
                  {hairstyle.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <footer className="-mx-4 shrink-0 border-t border-[#d6eeeb] bg-[#eaf8f6] px-4 pb-1 pt-4 sm:-mx-5 sm:px-5 lg:-mx-4 lg:px-4">
        <button
          type="button"
          disabled={!canGenerate || isGenerating}
          onClick={() => {
            if (selectedHairstyle && canGenerate) {
              onGenerate(selectedHairstyle);
            }
          }}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#258d87] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#1d7772] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d7772] disabled:cursor-not-allowed disabled:bg-[#9aa3b2] disabled:text-white/90 sm:text-base"
        >
          <Zap aria-hidden="true" size={18} fill="currentColor" />
          {isGenerating ? "Generating your look..." : "Generate My Look"}
        </button>
        {generationError && (
          <p
            className="mt-2 text-center text-xs leading-4 text-red-700"
            role="alert"
          >
            {generationError}
          </p>
        )}
        {!hasPhoto && (
          <p className="mt-2 text-center text-xs leading-4 text-[#586967]">
            Upload or capture a photo to choose a hairstyle.
          </p>
        )}
      </footer>
    </aside>
  );
}
