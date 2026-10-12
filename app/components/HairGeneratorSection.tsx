"use client";

import { useEffect, useRef, useState } from "react";
import type { HairstyleOption } from "../data/hairstyles";
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
  const photoPreviewUrlRef = useRef<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const generationRequestRef = useRef(0);

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

    const requestId = ++generationRequestRef.current;
    setIsGenerating(true);
    setGenerationError("");
    setGeneratedImage(null);

    try {
      const form = new FormData();
      form.set("photo", photo);
      form.set("hairstyleId", hairstyle.id);
      if (leadDetails) {
        form.set("firstName", leadDetails.firstName);
        form.set("lastName", leadDetails.lastName);
        form.set("phone", leadDetails.phone);
      }

      const response = await fetch("/api/hairstyle", {
        method: "POST",
        body: form,
      });
      const result = (await response.json()) as {
        image?: string;
        error?: string;
      };

      if (!response.ok) {
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
            : "Unable to generate the hairstyle. Please try again.",
        );
      }
    } finally {
      if (generationRequestRef.current === requestId) {
        setIsGenerating(false);
      }
    }
  };

  return (
    <>
      <div className="grid min-h-[760px] w-full grid-cols-1 items-stretch lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <HairPhotoUpload
          className="justify-center px-5 py-8 sm:px-8 lg:px-[7.5%] lg:py-6"
          onImageSelect={handlePhotoSelect}
        />
        <HairstyleSelector
          className="min-h-[680px] lg:min-h-[760px]"
          hasPhoto={photo !== null}
          selectedHairstyleId={selectedHairstyleId}
          onHairstyleSelect={handleHairstyleSelect}
          onGenerate={handleOpenLeadModal}
          isGenerating={isGenerating}
          generationError={generationError}
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
        <div ref={resultRef} className="w-full">
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
