"use client";

import Image from "next/image";
import { Check, ChevronDown, ChevronUp, Image as ImageIcon, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  rateLimitInfo?: {
    remaining: number;
    creditsUsed?: number;
    limit: number;
    resetTimestamp?: number;
  } | null;
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
  rateLimitInfo,
}: HairstyleSelectorProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    null,
  );
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [scrollRatio, setScrollRatio] = useState({
    topPercent: 0,
    heightPercent: 75,
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartScrollTopRef = useRef(0);

  const selectedId = selectedHairstyleId ?? internalSelectedId;
  const selectedHairstyle =
    hairstyles.find((hairstyle) => hairstyle.id === selectedId) ?? null;
  const isCreditExhausted = Boolean(rateLimitInfo && rateLimitInfo.remaining <= 0);
  const canGenerate = hasPhoto && selectedHairstyle !== null && onGenerate !== undefined;

  const formatResetTime = (timestamp?: number) => {
    if (!timestamp) return "the next daily reset time (midnight)";
    try {
      const date = new Date(timestamp);
      const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const now = Date.now();
      const diffMs = timestamp - now;
      if (diffMs > 0) {
        const hours = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const relStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        return `${timeStr} (in ${relStr})`;
      }
      return timeStr;
    } catch {
      return "the next daily reset time";
    }
  };

  const selectHairstyle = (hairstyle: HairstyleOption) => {
    setInternalSelectedId(hairstyle.id);
    onHairstyleSelect?.(hairstyle);
  };

  const updateVisibleHeight = () => {
    if (!gridRef.current) return;
    const cardElements = gridRef.current.children;
    // Exactly 6 cards (index 0 to 5, which forms 3 rows in a 2-column grid)
    if (cardElements.length >= 6) {
      const firstCard = cardElements[0] as HTMLElement;
      const sixthCard = cardElements[5] as HTMLElement;
      if (firstCard && sixthCard) {
        const topOffset = firstCard.offsetTop;
        const bottom = sixthCard.offsetTop + sixthCard.offsetHeight;
        const exactHeight = bottom - topOffset + 4;
        if (exactHeight > 200) {
          setContainerHeight(exactHeight);
        }
      }
    }
  };

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;
    const visibleRatio = scrollHeight > 0 ? clientHeight / scrollHeight : 1;
    const heightPercent = Math.max(20, Math.min(85, visibleRatio * 100));
    const progress = maxScroll > 0 ? scrollTop / maxScroll : 0;
    const topPercent = progress * (100 - heightPercent);
    setScrollRatio({ topPercent, heightPercent });
  };

  useEffect(() => {
    updateVisibleHeight();
    handleScroll();
    const timer1 = setTimeout(updateVisibleHeight, 100);
    const timer2 = setTimeout(updateVisibleHeight, 350);

    const observer = new ResizeObserver(() => {
      updateVisibleHeight();
      handleScroll();
    });

    if (gridRef.current) {
      observer.observe(gridRef.current);
    }

    window.addEventListener("resize", updateVisibleHeight);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      observer.disconnect();
      window.removeEventListener("resize", updateVisibleHeight);
    };
  }, [hairstyles]);

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current || !scrollContainerRef.current) return;
    const trackRect = trackRef.current.getBoundingClientRect();
    const clickY = e.clientY - trackRect.top;
    const clickRatio = Math.max(0, Math.min(1, clickY / trackRect.height));
    const el = scrollContainerRef.current;
    const maxScroll = el.scrollHeight - el.clientHeight;
    el.scrollTo({
      top: clickRatio * maxScroll,
      behavior: "smooth",
    });
  };

  const handleThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    if (scrollContainerRef.current) {
      dragStartScrollTopRef.current = scrollContainerRef.current.scrollTop;
    }
  };

  const handleThumbPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !trackRef.current || !scrollContainerRef.current) return;
    const trackHeight = trackRef.current.clientHeight;
    if (trackHeight <= 0) return;
    const el = scrollContainerRef.current;
    const maxScroll = el.scrollHeight - el.clientHeight;
    const deltaY = e.clientY - dragStartYRef.current;
    const deltaScroll = (deltaY / trackHeight) * el.scrollHeight;
    el.scrollTop = Math.max(0, Math.min(maxScroll, dragStartScrollTopRef.current + deltaScroll));
  };

  const handleThumbPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const scrollByAmount = (delta: number) => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollBy({
      top: delta,
      behavior: "smooth",
    });
  };

  return (
    <aside
      className={`flex min-h-0 w-full flex-col overflow-hidden bg-[#f1faf9] p-4 sm:p-5 md:p-6 lg:p-6 rounded-2xl sm:rounded-3xl border border-[#d6eeeb] ${className}`.trim()}
      aria-labelledby="hairstyle-selector-heading"
    >
      {/* Title & description */}
      <div className="mb-3 sm:mb-4 px-1 shrink-0 text-left">
        <h2
          id="hairstyle-selector-heading"
          className="text-lg sm:text-xl font-bold tracking-tight text-[#111827]"
        >
          Select your hairstyle
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-[#4b5563]">
          Pick the look you want to try on. You can switch anytime.
        </p>
      </div>

      {/* Grid container with side slider */}
      <div className="relative flex flex-1 min-h-0 w-full items-stretch gap-2 sm:gap-2.5">
        {/* Scrollable hairstyle cards area (showing exactly 6 cards at a time) */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          style={{
            height: containerHeight ? `${containerHeight}px` : undefined,
          }}
          className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-1 pt-1 sm:pt-2 pb-2 overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-h-[480px] sm:max-h-[520px] md:max-h-[560px]"
          aria-label="Hairstyle options"
          tabIndex={0}
        >
          <div
            ref={gridRef}
            className="mx-auto grid w-full max-w-[500px] grid-cols-2 gap-2.5 sm:gap-3 md:gap-3.5"
          >
            {hairstyles.map((hairstyle) => {
              const isSelected = hairstyle.id === selectedId;

              return (
                <button
                  key={hairstyle.id}
                  type="button"
                  onClick={() => selectHairstyle(hairstyle)}
                  disabled={!hasPhoto || isGenerating}
                  aria-pressed={isSelected}
                  className={`group relative flex flex-col min-w-0 overflow-hidden rounded-xl sm:rounded-2xl border bg-white text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00bba7] disabled:cursor-not-allowed disabled:opacity-60 ${
                    hasPhoto ? "hover:border-[#00bba7] hover:shadow-xs" : ""
                  } ${
                    isSelected
                      ? "border-2 border-[#00bba7] shadow-sm ring-1 ring-[#00bba7]/20"
                      : "border-[#d5e8e5]"
                  }`}
                >
                  <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-[#f7fbfa]">
                    {hairstyle.image ? (
                      <Image
                        src={hairstyle.image}
                        alt={`${hairstyle.name} hairstyle`}
                        fill
                        sizes="(max-width: 480px) 42vw, (max-width: 768px) 38vw, (max-width: 1024px) 20vw, 15vw"
                        className="object-contain p-1.5 sm:p-2 transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 text-center text-[#829794]">
                        <ImageIcon aria-hidden="true" size={24} strokeWidth={1.6} />
                        <span className="text-[10px] leading-4 sm:text-xs">
                          Hairstyle image unavailable
                        </span>
                      </div>
                    )}
                    {isSelected && (
                      <span className="absolute right-1.5 top-1.5 sm:right-2 sm:top-2 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-[#00bba7] text-white shadow-xs">
                        <Check aria-hidden="true" size={13} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <span className="block min-h-8 sm:min-h-9 px-1.5 py-1.5 sm:px-2 sm:py-2 text-center text-[11px] sm:text-xs md:text-sm font-semibold leading-tight text-[#203330] break-words">
                    {hairstyle.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Side slider control to slide up/down and reveal more images */}
        <div
          className="flex w-5 sm:w-6 flex-col items-center justify-between shrink-0 py-1"
          style={{
            height: containerHeight ? `${containerHeight}px` : "100%",
          }}
          aria-label="Hairstyle list slider"
        >
          {/* Slide up button */}
          <button
            type="button"
            onClick={() => scrollByAmount(-150)}
            tabIndex={-1}
            title="Slide up to view styles"
            aria-label="Slide up"
            className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-white text-[#00bba7] border border-[#d5ede9] hover:bg-[#e0f7f5] active:scale-95 transition cursor-pointer shadow-2xs mb-1"
          >
            <ChevronUp size={14} strokeWidth={2.5} />
          </button>

          {/* Slider track */}
          <div
            ref={trackRef}
            onPointerDown={handleTrackPointerDown}
            className="relative w-2.5 sm:w-3 flex-1 rounded-full bg-[#d5ede9] hover:bg-[#cbe6e2] transition-colors cursor-pointer select-none"
            role="scrollbar"
            aria-controls="hairstyle-options"
            aria-valuenow={Math.round(scrollRatio.topPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {/* Draggable slider thumb */}
            <div
              onPointerDown={handleThumbPointerDown}
              onPointerMove={handleThumbPointerMove}
              onPointerUp={handleThumbPointerUp}
              style={{
                height: `${scrollRatio.heightPercent}%`,
                top: `${scrollRatio.topPercent}%`,
              }}
              className="absolute left-0 right-0 rounded-full bg-[#00bba7] hover:bg-[#009686] active:bg-[#008072] cursor-grab active:cursor-grabbing shadow-xs transition-[top] duration-75"
            />
          </div>

          {/* Slide down button */}
          <button
            type="button"
            onClick={() => scrollByAmount(150)}
            tabIndex={-1}
            title="Slide down to view more styles"
            aria-label="Slide down"
            className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-white text-[#00bba7] border border-[#d5ede9] hover:bg-[#e0f7f5] active:scale-95 transition cursor-pointer shadow-2xs mt-1"
          >
            <ChevronDown size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Footer generate button & quota status */}
      <footer className="-mx-4 sm:-mx-5 md:-mx-6 lg:-mx-6 shrink-0 border-t border-[#d6eeeb] bg-[#eaf8f6] px-4 sm:px-5 md:px-6 lg:px-6 pb-2.5 pt-3 sm:pb-3 sm:pt-4 mt-3 sm:mt-4">
        <button
          type="button"
          disabled={!canGenerate || isGenerating}
          onClick={() => {
            if (selectedHairstyle && canGenerate) {
              onGenerate(selectedHairstyle);
            }
          }}
          className="flex min-h-12 sm:min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#00bba7] px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base font-bold text-white transition-colors hover:bg-[#00a392] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00a392] disabled:cursor-not-allowed disabled:bg-[#9aa3b2] disabled:text-white/90 shadow-xs cursor-pointer"
        >
          <Zap aria-hidden="true" size={18} fill="currentColor" />
          {isGenerating ? "Generating your look..." : "Generate My Look"}
        </button>

        {/* Free Quota Badge (Active) */}
        {rateLimitInfo && !isCreditExhausted && (
          <div className="mt-2 flex items-center justify-between px-2 text-[11px] font-medium text-[#007064]">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00bba7] animate-pulse" />
              Daily Free Limit:
            </span>
            <span className="font-semibold">
              {rateLimitInfo.remaining} / {rateLimitInfo.limit} styles remaining (
              {rateLimitInfo.creditsUsed ?? Math.max(0, rateLimitInfo.limit - rateLimitInfo.remaining)}{" "}
              used)
            </span>
          </div>
        )}

        {/* Prominent Daily Credits Exhausted Alert */}
        {rateLimitInfo && isCreditExhausted && (
          <div
            className="mt-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-left text-xs text-amber-900 shadow-2xs"
            role="alert"
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-amber-500 shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-amber-950">
                  You have used all your daily credits.
                </p>
                <p className="mt-0.5 leading-relaxed text-amber-800">
                  Your credits will reset at {formatResetTime(rateLimitInfo.resetTimestamp)}.
                </p>
                <div className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-amber-900">
                  <span>Remaining: 0</span>
                  <span>•</span>
                  <span>
                    Used: {rateLimitInfo.creditsUsed ?? rateLimitInfo.limit} / {rateLimitInfo.limit}
                  </span>
                </div>
                <a
                  href={`https://wa.me/919999999999?text=${encodeURIComponent(
                    "Hi! I reached my free AI hair preview quota on your website and would like to speak with a hair specialist."
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 font-bold text-[#008c7c] hover:underline"
                >
                  Connect with our Hair Specialist on WhatsApp &rarr;
                </a>
              </div>
            </div>
          </div>
        )}

        {generationError && !isCreditExhausted && (
          <div
            className="mt-2.5 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-left text-red-700"
            role="alert"
          >
            <p className="font-medium leading-relaxed">{generationError}</p>
          </div>
        )}

        {!hasPhoto && !generationError && (
          <p className="mt-2 text-center text-xs leading-4 text-[#586967]">
            Upload or capture a photo to choose a hairstyle.
          </p>
        )}
      </footer>
    </aside>
  );
}
