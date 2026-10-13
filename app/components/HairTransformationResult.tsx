"use client";

import Image from "next/image";
import { ArrowRight, Check, Download } from "lucide-react";

type HairTransformationResultProps = {
  originalPhotoUrl: string;
  generatedImageUrl: string;
  hairstyleName: string;
  onTryDifferentStyle: () => void;
  leadPhone?: string;
};

export default function HairTransformationResult({
  originalPhotoUrl,
  generatedImageUrl,
  hairstyleName,
  onTryDifferentStyle,
}: HairTransformationResultProps) {
  const handleDownload = () => {
    try {
      const link = document.createElement("a");
      link.href = generatedImageUrl;
      link.download = `my-${hairstyleName.toLowerCase().replace(/\s+/g, "-")}-transformation.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      window.open(generatedImageUrl, "_blank");
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Hi! I just generated my ${hairstyleName} hairstyle transformation look and would like to talk with a hair expert.`
  );
  const whatsappUrl = `https://wa.me/919999999999?text=${whatsappMessage}`;

  return (
    <section
      className="w-full bg-[#f1faf8] py-8 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-10 transition-all animate-in fade-in duration-300"
      aria-labelledby="transformation-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 items-center gap-6 sm:gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Left Column: Side-by-side Portrait Photos */}
          <div className="lg:col-span-6 xl:col-span-7">
            <div className="grid grid-cols-2 gap-2 sm:gap-4 md:gap-5">
              {/* Original Photo */}
              <div className="relative aspect-[3/4] sm:aspect-[4/5] w-full overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl bg-[#e5f2ef] shadow-sm">
                <Image
                  src={originalPhotoUrl}
                  alt="Original photo"
                  fill
                  unoptimized
                  className="object-cover object-top"
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 25vw"
                />
              </div>

              {/* Generated Result Photo */}
              <div className="relative aspect-[3/4] sm:aspect-[4/5] w-full overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl bg-[#e5f2ef] shadow-sm">
                <Image
                  src={generatedImageUrl}
                  alt={`AI generated ${hairstyleName} hairstyle`}
                  fill
                  unoptimized
                  className="object-cover object-top"
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 25vw"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Information & Actions */}
          <div className="flex flex-col items-start lg:col-span-6 xl:col-span-5">
            {/* Pill Badge */}
            <div className="inline-flex items-center rounded-full border border-[#00bba7]/40 bg-[#e4f7f4] px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-[#0d7a71]">
              Your transformation is ready
            </div>

            {/* Headline */}
            <h2
              id="transformation-heading"
              className="mt-3 sm:mt-4 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#111827] leading-[1.12]"
            >
              This could be you.
              <br />
              For real.
            </h2>

            {/* Sub-label */}
            <p className="mt-3 sm:mt-5 text-xs sm:text-sm md:text-base font-semibold text-[#4b5563]">
              With the help of
            </p>

            {/* Treatment Badges */}
            <div className="mt-2 flex flex-wrap gap-2 sm:gap-2.5">
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#a3e6dd] bg-[#e6f8f5] px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold text-[#0d7a71]">
                <span className="flex h-4 w-4 items-center justify-center rounded border border-[#00bba7] text-[#00bba7]">
                  <Check size={12} strokeWidth={3} />
                </span>
                Hair Transplant
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#a3e6dd] bg-[#e6f8f5] px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold text-[#0d7a71]">
                <span className="flex h-4 w-4 items-center justify-center rounded border border-[#00bba7] text-[#00bba7]">
                  <Check size={12} strokeWidth={3} />
                </span>
                Hair Replacement
              </div>
            </div>

            {/* Description */}
            <p className="mt-3 sm:mt-4 text-xs sm:text-sm md:text-base text-[#4b5563] leading-relaxed">
              If you&apos;re ready to make this look real, talk to our experts now and make it happen!
            </p>

            {/* CTA Buttons */}
            <div className="mt-5 sm:mt-8 flex w-full flex-col gap-2.5 sm:gap-3.5">
              {/* Button 1: WhatsApp Expert */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[48px] sm:min-h-[54px] md:min-h-[56px] w-full items-center justify-center gap-2 sm:gap-2.5 rounded-xl bg-[#00bba7] px-4 sm:px-6 py-3 text-sm sm:text-base md:text-lg font-bold text-white text-center shadow-xs transition-colors hover:bg-[#00a392]"
              >
                <svg
                  className="h-5 w-5 fill-current shrink-0"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-5.805 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
                Chat with a hair expert now
              </a>

              {/* Button 2: Download Result */}
              <button
                type="button"
                onClick={handleDownload}
                className="flex min-h-[48px] sm:min-h-[54px] md:min-h-[56px] w-full items-center justify-center gap-2 sm:gap-2.5 rounded-xl border border-[#d1d5db] bg-white px-4 sm:px-6 py-3 text-sm sm:text-base md:text-lg font-bold text-[#111827] shadow-xs transition-colors hover:bg-gray-50 cursor-pointer"
              >
                <Download size={20} strokeWidth={2.2} className="shrink-0" />
                Download my result
              </button>

              {/* Button 3: Try Different Hairstyle */}
              <button
                type="button"
                onClick={onTryDifferentStyle}
                className="flex min-h-[44px] sm:min-h-[48px] md:min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-[#a8e5dc] bg-[#e6f8f5] px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base md:text-lg font-bold text-[#0d7a71] transition-colors hover:bg-[#d9f5f0] cursor-pointer"
              >
                Try a different hairstyle
                <ArrowRight size={18} strokeWidth={2.5} className="shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
