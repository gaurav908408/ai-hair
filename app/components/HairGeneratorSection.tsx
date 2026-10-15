"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { HairstyleOption } from "../data/hairstyles";
import { getVisitorIdentification } from "../utils/fingerprint";
import HairPhotoUpload from "./HairPhotoUpload";
import HairstyleSelector from "./HairstyleSelector";
import LeadCaptureModal from "./LeadCaptureModal";
import GenerationLoadingModal from "./GenerationLoadingModal";
import HairTransformationResult from "./HairTransformationResult";

export default function HairGeneratorSection() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [selectedHairstyleId, setSelectedHairstyleId] = useState<string>();
  const [generatedHairstyle, setGeneratedHairstyle] =
    useState<HairstyleOption | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [pendingHairstyle, setPendingHairstyle] = useState<HairstyleOption | null>(null);
  const [leadPhone, setLeadPhone] = useState<string>("");
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    remaining: number;
    creditsUsed?: number;
    limit: number;
    resetTimestamp?: number;
  } | null>(null);

  const photoPreviewUrlRef = useRef<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const generationRequestRef = useRef(0);

  /**
   * Fetches authoritative credit balance from backend database.
   * Consistent across tabs, reloads, and browser sessions.
   */
  const fetchCreditStatus = useCallback(async (phone?: string) => {
    try {
      const visitor = await getVisitorIdentification();
      const phoneQuery = phone ? `?phone=${encodeURIComponent(phone)}` : "";
      const res = await fetch(`/api/rate-limit${phoneQuery}`, {
        headers: {
          "X-Visitor-Id": visitor.visitorId,
          "X-Hardware-Hash": visitor.hardwareHash,
          "X-Device-Id": visitor.deviceId,
        },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data.remaining === "number") {
        setRateLimitInfo({
          remaining: data.remaining,
          creditsUsed: data.creditsUsed ?? Math.max(0, data.limit - data.remaining),
          limit: data.limit,
          resetTimestamp: data.resetTimestamp,
        });
      }
    } catch {
      // silent network fallback
    }
  }, []);

  // 1. Initial credit fetch on mount
  useEffect(() => {
    fetchCreditStatus(leadPhone);
  }, [fetchCreditStatus, leadPhone]);

  // 2. Tab switching & window focus synchronization:
  // When user switches tabs or refocuses window, fetch the real balance from server
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchCreditStatus(leadPhone);
      }
    };

    const handleFocus = () => {
      fetchCreditStatus(leadPhone);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchCreditStatus, leadPhone]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrlRef.current) {
        URL.revokeObjectURL(photoPreviewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (generatedHairstyle && generatedImage) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [generatedHairstyle, generatedImage]);

  const handleHairstyleSelect = (hairstyle: HairstyleOption) => {
    setSelectedHairstyleId(hairstyle.id);
    setGeneratedHairstyle(null);
    setGeneratedImage(null);
  };

  const handlePhotoSelect = (file: File) => {
    generationRequestRef.current += 1;
    setPhoto(file);
    if (photoPreviewUrlRef.current) {
      URL.revokeObjectURL(photoPreviewUrlRef.current);
    }
    const previewUrl = URL.createObjectURL(file);
    photoPreviewUrlRef.current = previewUrl;
    setPhotoPreviewUrl(previewUrl);
    setGeneratedHairstyle(null);
    setGeneratedImage(null);
    setGenerationError("");
    setIsGenerating(false);
  };

  const handleOpenLeadModal = (hairstyle: HairstyleOption) => {
    if (!photo || isGenerating) {
      return;
    }
    // Block modal if user has exhausted their credits
    if (rateLimitInfo && rateLimitInfo.remaining <= 0) {
      setGenerationError(
        "You have used all your daily credits. Your credits will reset at the next reset time."
      );
      return;
    }
    setPendingHairstyle(hairstyle);
    setGenerationError("");
    setShowLeadModal(true);
  };

  const handleLeadSubmit = (leadDetails: { firstName: string; lastName: string; phone: string }) => {
    setShowLeadModal(false);
    setLeadPhone(leadDetails.phone);
    if (pendingHairstyle) {
      executeGeneration(pendingHairstyle, leadDetails);
    }
  };

  const handleTryDifferentStyle = () => {
    setGeneratedHairstyle(null);
    setGeneratedImage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const executeGeneration = async (
    hairstyle: HairstyleOption,
    leadDetails?: { firstName: string; lastName: string; phone: string }
  ) => {
    if (!photo || isGenerating) {
      return;
    }

    if (rateLimitInfo && rateLimitInfo.remaining <= 0) {
      setGenerationError(
        "You have used all your daily credits. Your credits will reset at the next reset time."
      );
      return;
    }

    const currentPhone = leadDetails?.phone || leadPhone;
    const requestId = ++generationRequestRef.current;
    setIsGenerating(true);
    setGenerationError("");
    setGeneratedImage(null);

    try {
      const visitor = await getVisitorIdentification();

      const form = new FormData();
      form.set("photo", photo);
      form.set("hairstyleId", hairstyle.id);
      form.set("visitorId", visitor.visitorId);
      form.set("hardwareHash", visitor.hardwareHash);
      form.set("deviceId", visitor.deviceId);

      if (leadDetails) {
        form.set("firstName", leadDetails.firstName);
        form.set("lastName", leadDetails.lastName);
        form.set("phone", leadDetails.phone);
      } else if (currentPhone) {
        form.set("phone", currentPhone);
      }

      const response = await fetch("/api/hairstyle", {
        method: "POST",
        headers: {
          "X-Visitor-Id": visitor.visitorId,
          "X-Hardware-Hash": visitor.hardwareHash,
          "X-Device-Id": visitor.deviceId,
        },
        body: form,
      });

      // Update credit balance directly from server response headers
      const remainingHeader = response.headers.get("X-RateLimit-Remaining");
      const limitHeader = response.headers.get("X-RateLimit-Limit");
      const resetHeader = response.headers.get("X-RateLimit-Reset");
      if (remainingHeader !== null && limitHeader !== null) {
        const rem = parseInt(remainingHeader, 10);
        const lim = parseInt(limitHeader, 10);
        setRateLimitInfo({
          remaining: rem,
          creditsUsed: Math.max(0, lim - rem),
          limit: lim,
          resetTimestamp: resetHeader ? parseInt(resetHeader, 10) * 1000 : Date.now() + 86400000,
        });
      }

      const result = (await response.json()) as {
        image?: string;
        error?: string;
        rateLimit?: {
          limit: number;
          remaining: number;
          creditsUsed?: number;
          resetTimestamp: number;
          retryAfterSeconds: number;
        };
      };

      if (!response.ok) {
        if (response.status === 429 && result.rateLimit) {
          setRateLimitInfo({
            remaining: 0,
            creditsUsed: result.rateLimit.limit,
            limit: result.rateLimit.limit,
            resetTimestamp: result.rateLimit.resetTimestamp,
          });
        }
        throw new Error(result.error || "Unable to generate the hairstyle.");
      }

      if (!result.image?.startsWith("data:image/")) {
        throw new Error("The image service returned an invalid result.");
      }

      if (generationRequestRef.current !== requestId) {
        return;
      }
      setGeneratedHairstyle(hairstyle);
      setGeneratedImage(result.image);
    } catch (error) {
      if (generationRequestRef.current === requestId) {
        setGenerationError(
          error instanceof Error
            ? error.message
            : "Unable to generate the hairstyle. Please try again."
        );
      }
    } finally {
      if (generationRequestRef.current === requestId) {
        setIsGenerating(false);
      }
      // Re-synchronize credit balance from database
      fetchCreditStatus(currentPhone);
    }
  };

  return (
    <>
      <div className="grid min-h-0 w-full grid-cols-1 items-stretch lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <HairPhotoUpload
          className="justify-center px-4 py-6 sm:px-6 sm:py-8 md:px-8 lg:px-[6%] xl:px-[7.5%] lg:py-8"
          onImageSelect={handlePhotoSelect}
        />
        <HairstyleSelector
          hasPhoto={photo !== null}
          selectedHairstyleId={selectedHairstyleId}
          onHairstyleSelect={handleHairstyleSelect}
          onGenerate={handleOpenLeadModal}
          isGenerating={isGenerating}
          generationError={generationError}
          rateLimitInfo={rateLimitInfo}
        />
      </div>

      <LeadCaptureModal
        isOpen={showLeadModal}
        onClose={() => setShowLeadModal(false)}
        onSubmit={handleLeadSubmit}
        isSubmitting={isGenerating}
      />
      <GenerationLoadingModal isOpen={isGenerating} />
      {generatedHairstyle && generatedImage && photoPreviewUrl && (
        <div ref={resultRef} className="w-full scroll-mt-8">
          <HairTransformationResult
            originalPhotoUrl={photoPreviewUrl}
            generatedImageUrl={generatedImage}
            hairstyleName={generatedHairstyle.name}
            onTryDifferentStyle={handleTryDifferentStyle}
            leadPhone={leadPhone}
          />
        </div>
      )}
    </>
  );
}
