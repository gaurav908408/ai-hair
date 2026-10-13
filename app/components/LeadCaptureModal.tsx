"use client";

import { useState } from "react";
import { X } from "lucide-react";

type LeadCaptureModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (details: { firstName: string; lastName: string; phone: string }) => void;
  isSubmitting?: boolean;
};

export default function LeadCaptureModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: LeadCaptureModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const cleanPhone = phone.trim().replace(/\D/g, "");

    if (!trimmedFirst) {
      setErrorMessage("Please enter your first name.");
      return;
    }

    if (cleanPhone.length !== 10) {
      setErrorMessage("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (!agreed) {
      setErrorMessage("Please agree to the Terms & Conditions.");
      return;
    }

    onSubmit({
      firstName: trimmedFirst,
      lastName: trimmedLast,
      phone: cleanPhone,
    });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(val);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 md:p-6 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-modal-title"
    >
      <div
        className="relative w-full max-w-[550px] overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-2xl transition-all max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 sm:right-5 sm:top-5 z-10 rounded-full p-1.5 sm:p-2 text-gray-700 hover:bg-gray-100 hover:text-black transition"
          aria-label="Close modal"
        >
          <X className="size-5 sm:size-6" strokeWidth={2.4} />
        </button>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          <div className="overflow-y-auto px-5 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6 md:px-10 md:pt-10 md:pb-8">
            {/* Pill Tag */}
            <div className="inline-flex items-center rounded-full border border-[#86e1da] bg-[#eaf8f6] px-3.5 py-1 text-xs sm:text-sm font-semibold text-[#18756f]">
              While we work on your result
            </div>

            {/* Title */}
            <h2
              id="lead-modal-title"
              className="mt-2.5 sm:mt-3.5 text-xl sm:text-2xl md:text-[30px] lg:text-[34px] font-extrabold tracking-tight text-[#111827] leading-tight"
            >
              Where should we send your result?
            </h2>

            {/* Subtitle */}
            <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm md:text-base text-[#4b5563]">
              Enter your details. We&apos;ll share your results on WhatsApp.
            </p>

            {/* Name Fields */}
            <div className="mt-4 sm:mt-6">
              <label className="block text-sm sm:text-base font-bold text-[#111827] mb-1.5 sm:mb-2.5">
                Your Name
              </label>
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5 sm:gap-3.5 md:gap-4">
                <input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-xl sm:rounded-2xl border border-[#9ee1dc] px-3.5 sm:px-4 md:px-5 py-2.5 sm:py-3.5 md:py-4 text-sm sm:text-base text-[#111827] placeholder-[#9ca3af] outline-none transition focus:border-[#258d87] focus:ring-2 focus:ring-[#258d87]/20"
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-xl sm:rounded-2xl border border-[#9ee1dc] px-3.5 sm:px-4 md:px-5 py-2.5 sm:py-3.5 md:py-4 text-sm sm:text-base text-[#111827] placeholder-[#9ca3af] outline-none transition focus:border-[#258d87] focus:ring-2 focus:ring-[#258d87]/20"
                />
              </div>
            </div>

            {/* Mobile Number Field */}
            <div className="mt-4 sm:mt-5">
              <label className="block text-sm sm:text-base font-bold text-[#111827] mb-1.5 sm:mb-2.5">
                Mobile Number
              </label>
              <div className="flex rounded-xl sm:rounded-2xl border border-[#9ee1dc] overflow-hidden focus-within:border-[#258d87] focus-within:ring-2 focus-within:ring-[#258d87]/20">
                <span className="flex items-center justify-center px-3.5 sm:px-4 md:px-5 py-2.5 sm:py-3.5 md:py-4 border-r border-[#9ee1dc] bg-[#fafcfb] text-sm sm:text-base md:text-lg font-bold text-[#111827]">
                  +91
                </span>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="flex-1 px-3.5 sm:px-4 md:px-5 py-2.5 sm:py-3.5 md:py-4 text-sm sm:text-base md:text-[17px] text-[#111827] placeholder-[#9ca3af] outline-none"
                />
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="mt-4 sm:mt-5 flex items-start sm:items-center gap-2.5 sm:gap-3">
              <input
                type="checkbox"
                id="terms"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 sm:mt-0 h-4.5 w-4.5 sm:h-5 sm:w-5 rounded border-gray-300 text-[#00bba7] focus:ring-[#00bba7] cursor-pointer shrink-0"
              />
              <label htmlFor="terms" className="text-xs sm:text-sm md:text-[15px] text-[#374151] cursor-pointer select-none">
                I agree with the{" "}
                <span className="text-[#00a896] underline font-medium">
                  Terms &amp; Conditions
                </span>
              </label>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <p className="mt-3 text-xs sm:text-sm font-semibold text-red-600" role="alert">
                {errorMessage}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#00bba7] hover:bg-[#00a391] active:bg-[#009080] text-white py-3.5 sm:py-4 md:py-5 text-sm sm:text-base md:text-lg font-bold tracking-wide transition disabled:opacity-75 disabled:cursor-not-allowed text-center shrink-0 cursor-pointer"
          >
            {isSubmitting ? "Generating your look..." : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
}
