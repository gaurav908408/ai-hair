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
  const [agreed, setAgreed] = useState(true);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-modal-title"
    >
      <div
        className="relative w-full max-w-[550px] overflow-hidden rounded-3xl bg-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-10 rounded-full p-2 text-gray-700 hover:bg-gray-100 hover:text-black transition"
          aria-label="Close modal"
        >
          <X size={24} strokeWidth={2.4} />
        </button>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-7 pt-8 pb-6 sm:px-10 sm:pt-10 sm:pb-8">
            {/* Pill Tag */}
            <div className="inline-flex items-center rounded-full border border-[#86e1da] bg-[#eaf8f6] px-4 py-1.5 text-xs sm:text-sm font-semibold text-[#18756f]">
              While we work on your result
            </div>

            {/* Title */}
            <h2
              id="lead-modal-title"
              className="mt-3.5 text-2xl sm:text-[34px] font-extrabold tracking-tight text-[#111827] leading-tight"
            >
              Where should we send your result?
            </h2>

            {/* Subtitle */}
            <p className="mt-2 text-base sm:text-[16px] text-[#4b5563]">
              Enter your details. We&apos;ll share your results on WhatsApp.
            </p>

            {/* Name Fields */}
            <div className="mt-6">
              <label className="block text-[15px] sm:text-base font-bold text-[#111827] mb-2.5">
                Your Name
              </label>
              <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
                <input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-xl sm:rounded-2xl border border-[#9ee1dc] px-4 sm:px-5 py-3.5 sm:py-4 text-base text-[#111827] placeholder-[#9ca3af] outline-none transition focus:border-[#258d87] focus:ring-2 focus:ring-[#258d87]/20"
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-xl sm:rounded-2xl border border-[#9ee1dc] px-4 sm:px-5 py-3.5 sm:py-4 text-base text-[#111827] placeholder-[#9ca3af] outline-none transition focus:border-[#258d87] focus:ring-2 focus:ring-[#258d87]/20"
                />
              </div>
            </div>

            {/* Mobile Number Field */}
            <div className="mt-5">
              <label className="block text-[15px] sm:text-base font-bold text-[#111827] mb-2.5">
                Mobile Number
              </label>
              <div className="flex rounded-xl sm:rounded-2xl border border-[#9ee1dc] overflow-hidden focus-within:border-[#258d87] focus-within:ring-2 focus-within:ring-[#258d87]/20">
                <span className="flex items-center justify-center px-4 sm:px-5 py-3.5 sm:py-4 border-r border-[#9ee1dc] bg-[#fafcfb] text-base sm:text-lg font-bold text-[#111827]">
                  +91
                </span>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="flex-1 px-4 sm:px-5 py-3.5 sm:py-4 text-base sm:text-[17px] text-[#111827] placeholder-[#9ca3af] outline-none"
                />
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="mt-5 flex items-center gap-3">
              <input
                type="checkbox"
                id="terms"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-[#00bba7] focus:ring-[#00bba7] cursor-pointer"
              />
              <label htmlFor="terms" className="text-sm sm:text-[15px] text-[#374151] cursor-pointer select-none">
                I agree with the{" "}
                <span className="text-[#00a896] underline font-medium">
                  Terms &amp; Conditions
                </span>
              </label>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <p className="mt-3.5 text-sm font-semibold text-red-600" role="alert">
                {errorMessage}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#00bba7] hover:bg-[#00a391] active:bg-[#009080] text-white py-4 sm:py-5 text-base sm:text-lg font-bold tracking-wide transition disabled:opacity-75 disabled:cursor-not-allowed text-center"
          >
            {isSubmitting ? "Generating your look..." : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
}
