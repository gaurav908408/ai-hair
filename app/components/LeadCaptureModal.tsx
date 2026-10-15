"use client";

import { useState, useEffect, useRef } from "react";
import { X, ArrowLeft, ShieldCheck, RefreshCw } from "lucide-react";

type LeadCaptureModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (details: {
    firstName: string;
    lastName: string;
    phone: string;
    verificationToken?: string;
  }) => void;
  isSubmitting?: boolean;
};

export default function LeadCaptureModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: LeadCaptureModalProps) {
  const [step, setStep] = useState<"details" | "otp">("details");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [receivedOtp, setReceivedOtp] = useState<string | null>(null);

  const otpInputRef = useRef<HTMLInputElement>(null);

  // Focus OTP input on step switch
  useEffect(() => {
    if (step === "otp") {
      setTimeout(() => otpInputRef.current?.focus(), 100);
    }
  }, [step]);

  // Resend cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage("");
    setInfoMessage("");

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

    setIsSendingOtp(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        retryAfterSeconds?: number;
        devOtp?: string;
      };

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Unable to send verification code. Please try again.");
        return;
      }

      setStep("otp");
      setResendCooldown(data.retryAfterSeconds || 30);

      if (data.devOtp) {
        setReceivedOtp(data.devOtp);
        setOtp(data.devOtp);
        setInfoMessage(`Verification Code: ${data.devOtp} (Auto-filled below for testing)`);
      } else {
        setReceivedOtp(null);
        setInfoMessage(`Verification code sent via SMS to +91 ${cleanPhone}.`);
      }
    } catch {
      setErrorMessage("Network error sending code. Please check your connection.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setInfoMessage("");

    const cleanPhone = phone.trim().replace(/\D/g, "");
    const cleanOtp = otp.trim().replace(/\D/g, "");

    if (cleanOtp.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, otp: cleanOtp }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        verificationToken?: string;
        phone?: string;
      };

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Invalid verification code. Please check and try again.");
        return;
      }

      onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: cleanPhone,
        verificationToken: data.verificationToken,
      });
    } catch {
      setErrorMessage("Network error during verification. Please try again.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(val);
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(val);
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

        {step === "details" ? (
          <form onSubmit={handleSendOtp} className="flex flex-col min-h-0">
            <div className="overflow-y-auto px-5 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6 md:px-10 md:pt-10 md:pb-8">
              {/* Pill Tag */}
              <div className="inline-flex items-center rounded-full border border-[#86e1da] bg-[#eaf8f6] px-3.5 py-1 text-xs sm:text-sm font-semibold text-[#18756f]">
                Daily Free Limit: 2 Styles
              </div>

              {/* Title */}
              <h2
                id="lead-modal-title"
                className="mt-2.5 sm:mt-3.5 text-xl sm:text-2xl md:text-[30px] lg:text-[34px] font-extrabold tracking-tight text-[#111827] leading-tight"
              >
                Where should we send your look?
              </h2>

              {/* Subtitle */}
              <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm md:text-base text-[#4b5563]">
                Enter your mobile number to verify your 2 daily image credits.
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
                  Mobile Number (for verification)
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
              disabled={isSendingOtp}
              className="w-full bg-[#00bba7] hover:bg-[#00a391] active:bg-[#009080] text-white py-3.5 sm:py-4 md:py-5 text-sm sm:text-base md:text-lg font-bold tracking-wide transition disabled:opacity-75 disabled:cursor-not-allowed text-center shrink-0 cursor-pointer"
            >
              {isSendingOtp ? "Sending code..." : "Continue & Verify"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="flex flex-col min-h-0">
            <div className="overflow-y-auto px-5 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6 md:px-10 md:pt-10 md:pb-8">
              {/* Back to change phone button */}
              <button
                type="button"
                onClick={() => {
                  setStep("details");
                  setErrorMessage("");
                  setReceivedOtp(null);
                  setOtp("");
                }}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#18756f] hover:underline mb-2 cursor-pointer"
              >
                <ArrowLeft className="size-4" /> Change Mobile Number
              </button>

              {/* Title */}
              <h2
                id="lead-modal-title"
                className="mt-1 text-xl sm:text-2xl md:text-[30px] font-extrabold tracking-tight text-[#111827] leading-tight"
              >
                Verify Your Number
              </h2>

              {/* Subtitle */}
              <p className="mt-1.5 text-xs sm:text-sm md:text-base text-[#4b5563]">
                Enter the 6-digit code sent to{" "}
                <span className="font-bold text-[#111827]">+91 {phone}</span> to unlock your 2 daily hairstyles.
              </p>

              {/* Prominent Verification Code Card for instant testing */}
              {receivedOtp ? (
                <div className="mt-4 p-3.5 bg-gradient-to-r from-[#eaf8f6] to-[#d8f3f0] border-2 border-[#86e1da] rounded-xl text-center shadow-xs">
                  <p className="text-xs text-[#18756f] font-bold uppercase tracking-wider">
                    Demo Verification Code
                  </p>
                  <p className="text-3xl font-mono font-extrabold text-[#115e59] tracking-[0.25em] my-1">
                    {receivedOtp}
                  </p>
                  <p className="text-[12px] text-[#18756f]">
                    Code auto-filled below. Click <strong>Verify &amp; Generate</strong> to proceed!
                  </p>
                </div>
              ) : infoMessage ? (
                <div className="mt-3 rounded-lg bg-[#eaf8f6] border border-[#86e1da] p-2.5 text-xs sm:text-sm font-medium text-[#18756f]">
                  {infoMessage}
                </div>
              ) : null}

              {/* OTP Field */}
              <div className="mt-4 sm:mt-5">
                <label className="block text-sm sm:text-base font-bold text-[#111827] mb-2">
                  6-Digit Verification Code
                </label>
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="------"
                  value={otp}
                  onChange={handleOtpChange}
                  maxLength={6}
                  className="w-full text-center tracking-[0.4em] font-mono font-bold text-2xl sm:text-3xl rounded-xl sm:rounded-2xl border border-[#9ee1dc] py-3 sm:py-4 text-[#111827] placeholder-[#9ca3af] outline-none transition focus:border-[#258d87] focus:ring-2 focus:ring-[#258d87]/20"
                />
              </div>

              {/* Resend OTP Button / Cooldown */}
              <div className="mt-4 flex items-center justify-between text-xs sm:text-sm text-[#4b5563]">
                <span>Didn&apos;t receive code?</span>
                {resendCooldown > 0 ? (
                  <span className="font-semibold text-gray-500">
                    Resend in {resendCooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={isSendingOtp}
                    className="inline-flex items-center gap-1 font-bold text-[#00a896] hover:underline cursor-pointer"
                  >
                    <RefreshCw className="size-3.5" /> Resend Code
                  </button>
                )}
              </div>

              {/* Error Message */}
              {errorMessage && (
                <p className="mt-3 text-xs sm:text-sm font-semibold text-red-600" role="alert">
                  {errorMessage}
                </p>
              )}

              {/* Security Note */}
              <div className="mt-5 flex items-center gap-2 text-xs text-gray-500">
                <ShieldCheck className="size-4 text-[#00bba7]" />
                <span>Credits are securely tied to your verified mobile number.</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isVerifyingOtp || isSubmitting || otp.length !== 6}
              className="w-full bg-[#00bba7] hover:bg-[#00a391] active:bg-[#009080] text-white py-3.5 sm:py-4 md:py-5 text-sm sm:text-base md:text-lg font-bold tracking-wide transition disabled:opacity-50 disabled:cursor-not-allowed text-center shrink-0 cursor-pointer"
            >
              {isVerifyingOtp || isSubmitting ? "Verifying & Generating..." : "Verify & Generate"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
